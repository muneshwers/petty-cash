import google from '@googleapis/drive';
import fs from 'fs';

export async function createDriveFolder(folderName) {
    const drive = google.drive({ version: 'v3', auth });
    
    const fileMetadata = {
        'name': folderName,
        'mimeType': 'application/vnd.google-apps.folder'
    };
    const folder = await drive.files.create({
        resource: fileMetadata,
        fields: 'id'
    });
    const folderId = folder.data.id;

    await drive.permissions.create({
        resource: {
            'type': 'anyone',
            'role': 'reader'
        },
        fileId: folderId,
        fields: 'id'
    });

    return folderId;
}


/**
 * 
 * @param {string} filePath 
 * @param {string} fileName
 * @param {string} folderId 
 */
export async function uploadFileInDriveFolder(filePath, fileName, folderId) {

    const drive = google.drive({ version: 'v3', auth });
    const fileMetadata = {
        name: fileName,
        parents: [folderId]
    };
    const media = {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(filePath)
    };

    await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'webViewLink'
    });

    const folderResponse = await drive.files.get({
        fileId: folderId,
        fields: 'webViewLink'
    });

    return folderResponse.data.webViewLink;
}


const auth = new google.auth.GoogleAuth({
    keyFile: './projectservers-2779d6d73579.json',
    scopes: ['https://www.googleapis.com/auth/drive']
})

