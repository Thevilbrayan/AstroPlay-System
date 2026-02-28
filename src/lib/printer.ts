export interface WristbandData {
    childName: string;
    parentName: string;
    startTime: string; // ISO String
    endTime: string; // ISO String
    sessionId: string; // Will be used as barcode
}

/**
 * Triggers a thermal print job for the AstroPlay security wristbands.
 * Currently mocks the integration with a thermal printer driver (like Zebra BrowserPrint).
 * 
 * @param data WristbandData
 */
export const triggerWristbandPrint = (data: WristbandData) => {
    // In a real implementation, this would format a ZPL (Zebra Programming Language) 
    // string or call a local device API to print the thermal wristband.

    const formattedStartTime = new Date(data.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedEndTime = new Date(data.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    console.log('--- 🖨️ THERMAL PRINTER JOB DISPATCHED ---');
    console.log({
        type: 'WRISTBAND_25x2.5',
        dpi: 203,
        content: {
            focus: {
                childName: data.childName.toUpperCase(),
                font: 'Sans Serif Bold, Large'
            },
            securityBlock: {
                barcode: {
                    type: 'Code 128',
                    value: data.sessionId
                }
            },
            responsibleInfo: {
                parentName: `Tutor: ${data.parentName}`,
            },
            timeIndicators: {
                in: `Entrada: ${formattedStartTime}`,
                out: `Salida: ${formattedEndTime}`
            },
            branding: 'AstroPlay Isotype (No Gradients)'
        }
    });
    console.log('------------------------------------------');
};
