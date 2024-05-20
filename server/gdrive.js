import google from '@googleapis/drive';
import fs from 'fs';

const folderId = '1OXEBsZ9ZHEQhYyodYg4IKV2TALqrdmpE';

/**
 * 
 * @param {string} filePath 
 * @param {string} folderName 
 */
export const uploadToDrive = async function(folderName) {
    const drive = google.drive({ version: 'v3', auth });
    const fileMetadata = {
        name: folderName,
        mimeType : 'application/vnd.google-apps.folder',
        parents : [folderId]
    };

    drive.files.create({
        resource: fileMetadata,
        fields : 'id',
    })

    // const media = {
    //     mimeType: 'image/jpeg',
    //     body: fs.createReadStream(filePath)
    // }

    // const response = await drive.files.create({
    //     resource: fileMetadata,
    //     media: media,
    //     fields: 'webViewLink'
    // });
    // /** @type {string} */
    // let link = response.data.webViewLink;
 
    // return link

    return
}

const auth = new google.auth.GoogleAuth({
    keyFile: './projectservers-2779d6d73579.json',
    scopes: ['https://www.googleapis.com/auth/drive']
})

