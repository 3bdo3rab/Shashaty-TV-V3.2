#[cfg(target_os = "windows")]
use windows::core::HSTRING;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::SIZE;
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP,
    BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP,
};
#[cfg(target_os = "windows")]
use windows::Win32::UI::Shell::{
    IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_RESIZETOFIT,
};
#[cfg(target_os = "windows")]
use std::mem::size_of;

#[tauri::command]
pub async fn get_video_thumbnail(path: String, width: u32, height: u32) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        get_windows_thumbnail(path, width, height).map_err(|e| e.to_string())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Not supported on this OS".to_string())
    }
}

#[cfg(target_os = "windows")]
fn get_windows_thumbnail(path: String, width: u32, height: u32) -> Result<String, Box<dyn std::error::Error>> {
    unsafe {
        let hstring_path = HSTRING::from(path);
        
        let factory: IShellItemImageFactory = SHCreateItemFromParsingName(&hstring_path, None)?;
        
        let size = SIZE {
            cx: width as i32,
            cy: height as i32,
        };
        
        let hbitmap: HBITMAP = factory.GetImage(size, SIIGBF_RESIZETOFIT)?;
        
        if hbitmap.is_invalid() {
            return Err("Failed to get image".into());
        }

        let mut bitmap: BITMAP = std::mem::zeroed();
        let res = GetObjectW(
            hbitmap.into(),
            size_of::<BITMAP>() as i32,
            Some(&mut bitmap as *mut _ as *mut std::ffi::c_void),
        );
        
        if res == 0 {
            DeleteObject(hbitmap.into());
            return Err("GetObjectW failed".into());
        }

        let hdc = CreateCompatibleDC(None);

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: bitmap.bmWidth,
                biHeight: -bitmap.bmHeight, // Negative for top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [std::mem::zeroed(); 1],
        };

        let pixel_count = (bitmap.bmWidth * bitmap.bmHeight) as usize;
        let mut pixels: Vec<u8> = vec![0; pixel_count * 4];

        let scanlines = GetDIBits(
            hdc,
            hbitmap,
            0,
            bitmap.bmHeight as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        DeleteDC(hdc);
        DeleteObject(hbitmap.into());

        if scanlines == 0 {
            return Err("GetDIBits failed".into());
        }

        // BGRA to RGBA (but wait, GDI is usually BGRA, and we can just use image::RgbaImage)
        // In BGRA: B=0, G=1, R=2, A=3
        for i in (0..pixels.len()).step_by(4) {
            let b = pixels[i];
            let r = pixels[i + 2];
            pixels[i] = r;
            pixels[i + 2] = b;
            // Set alpha to 255 if it's 0 to prevent transparency issues?
            // Some Windows thumbnails might return alpha=0 for opaque areas.
            pixels[i + 3] = 255; 
        }

        let img = image::RgbaImage::from_raw(bitmap.bmWidth as u32, bitmap.bmHeight as u32, pixels)
            .ok_or("Failed to create image buffer")?;

        let mut cursor = std::io::Cursor::new(Vec::new());
        img.write_to(&mut cursor, image::ImageFormat::Jpeg)?;
        
        use base64::Engine;
        let base64_str = base64::engine::general_purpose::STANDARD.encode(cursor.into_inner());
        
        Ok(format!("data:image/jpeg;base64,{}", base64_str))
    }
}

#[tauri::command]
pub async fn get_first_valid_thumbnail(paths: Vec<String>, width: u32, height: u32) -> Result<String, String> {
    for path in paths {
        if let Ok(b64) = get_windows_thumbnail(path.clone(), width, height) {
            return Ok(b64);
        }
    }
    Err("Failed to extract thumbnail for all provided paths".into())
}
