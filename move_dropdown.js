const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/views/LibraryView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

// 1. Extract dropdown
const startIdx = 1429; // Line 1430 (0-indexed)
const endIdx = 1635; // Line 1636 (0-indexed)

const dropdownBlock = lines.slice(startIdx, endIdx + 1).join('\n');

// 2. Remove dropdown from top bar
lines.splice(startIdx, endIdx - startIdx + 1);

// 3. Re-join
content = lines.join('\n');

// 4. Find insertion point in bottom bar
// We are looking for: {libraryTypeFilter === 'playlists' && ' ı⁄—÷ Â‰« «·„Ã·œ«  ÊﬁÊ«∆„ «· ‘€Ì· «· Ì  Õ ÊÌ Õ·ﬁ«  „ ⁄œœ…'}
//               </div>
//             </div>
const searchStr =                 {libraryTypeFilter === 'playlists' && ' ı⁄—÷ Â‰« «·„Ã·œ«  ÊﬁÊ«∆„ «· ‘€Ì· «· Ì  Õ ÊÌ Õ·ﬁ«  „ ⁄œœ…'}
              </div>;

const replaceStr =                 {libraryTypeFilter === 'playlists' && ' ı⁄—÷ Â‰« «·„Ã·œ«  ÊﬁÊ«∆„ «· ‘€Ì· «· Ì  Õ ÊÌ Õ·ﬁ«  „ ⁄œœ…'}
              </div>
 + dropdownBlock + 
            </div>;

if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully moved dropdown!');
} else {
    console.log('Could not find insertion point!');
}
