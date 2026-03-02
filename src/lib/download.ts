/**
 * Detects if we're running inside Tauri (desktop app) or a regular browser.
 */
function isTauri(): boolean {
    return !!(window as any).__TAURI_INTERNALS__;
}

/**
 * Save a Blob to disk. In Tauri: opens a native "Save As" dialog.
 * In browser: triggers a standard download.
 */
async function saveBlob(blob: Blob, defaultFilename: string, filters: { name: string; extensions: string[] }[]) {
    if (isTauri()) {
        try {
            // Dynamic imports — only loaded inside Tauri runtime
            const { save } = await import('@tauri-apps/plugin-dialog');
            const { writeFile } = await import('@tauri-apps/plugin-fs');

            const filePath = await save({
                defaultPath: defaultFilename,
                filters,
            });

            if (filePath) {
                const arrayBuffer = await blob.arrayBuffer();
                await writeFile(filePath, new Uint8Array(arrayBuffer));
            }
            return;
        } catch (e) {
            console.warn('Tauri save failed, falling back to browser download:', e);
        }
    }

    // Browser fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 250);
}

/**
 * Export a jsPDF document.
 */
export async function downloadPDF(doc: any, filename: string) {
    const blob: Blob = doc.output('blob');
    await saveBlob(blob, filename, [
        { name: 'PDF Document', extensions: ['pdf'] },
    ]);
}

/**
 * Export an ExcelJS workbook.
 */
export async function downloadExcelJS(workbook: any, filename: string) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await saveBlob(blob, filename, [
        { name: 'Excel Workbook', extensions: ['xlsx'] },
    ]);
}
