const fs = require('fs');
let code = fs.readFileSync('src/views/SettingsView.tsx', 'utf8');

// Add import
code = code.replace("import React, { useState, useRef, useEffect } from 'react';", "import React, { useState, useRef, useEffect } from 'react';\nimport { useDialog } from '../contexts/DialogContext';");

// Add hook
code = code.replace("const [dialog, setDialog] = useState<{type: 'alert' | 'confirm', message: string, onConfirm?: () => void, onCancel?: () => void} | null>(null);", "const { showAlert, showConfirm } = useDialog();");

// Replace window.confirm (already replaced by me before, let's fix it)
// It looks like this right now:
// setDialog({ type: 'confirm', message: '...', onConfirm: async () => { ... }, onCancel: () => setDialog(null) });
// We can just replace it with:
// if (await showConfirm('...', 'تأكيد الحذف', true)) { ... }

// Let's just restore the file from before I messed with setDialog and then run a clean replace.
