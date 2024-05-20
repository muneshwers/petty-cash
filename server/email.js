import nodemailer from "nodemailer";
import config from "../config.js";
import { google } from "googleapis";
import fs from "fs";
import { format } from "date-fns";

let { emailsOn } = config;
const folderId = '1OXEBsZ9ZHEQhYyodYg4IKV2TALqrdmpE';

const auth = new google.auth.GoogleAuth({
    keyFile: './projectservers-2779d6d73579.json',
    scopes: ['https://www.googleapis.com/auth/drive.file']
});

const drive = google.drive({ version: 'v3', auth });

const nearingLimitEmailTemplate = (account) => ({
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'procurement.coor@muneshwers.com, procurement.clerk@muneshwers.com, procurement.clerk2@muneshwers.com, procurement.supv@muneshwers.com',
    subject: `Petty Cash (${account}) - Nearing account limit. Reimburse as soon as possible!`,
    text: `Nearing account limit for (${account}). Reimburse as soon as possible!`,
    html: `<b>Nearing account limit for (${account}). Reimburse as soon as possible!</b>`,
});

const transactionMadeEmailTemplate = (account) => ({
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'fin.acct@muneshwers.com',
    subject: `Petty Cash (${account}) - New Transactions Made`,
    text: `New Transaction were made (${account}). Log in to Approve!`,
    html: `<b>New Transaction were made for (${account}). Log in to Approve!</b>`,
});

/**
 * 
 * @param {string} account 
 */
const approvalMadeEmailTemplate = (account) => {

    const approvalRecipients = {
        procurement: 'procurement.coor@muneshwers.com, procurement.clerk@muneshwers.com, procurement.clerk2@muneshwers.com, procurement.supv@muneshwers.com',
        meals: 'acc.snrclerk@muneshwers.com'
    };

    let recipients = approvalRecipients[account];
    if (!recipients) { recipients = approvalRecipients['procurement']; }
    const emailTemplate = {
        from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
        to: recipients,
        subject: `Petty Cash (${account}) - Transactions Approved!`,
        text: `Your transactions have been approved for (${account})! Log in to reimburse.`,
        html: `<b>Your transactions have been approved for (${account})! Log in to reimburse.</b>`,
    };
    return emailTemplate;
};

/**
 * 
 * @param {string} account 
 */
const reimbursementsMadeEmailTemplate = (account) => {

    const reimbursementsRecipients = {
        barges: 'accounts.sup@bargesolutionsgy.com',
        muneshwers: 'mngt.acct@muneshwers.com',
        paragon: 'accounts.sup@paragon-transportation.com',
        meals: 'acc.snrclerk@muneshwers.com'
    };

    const recipients = reimbursementsRecipients[account];
    const emailTemplate = {
        from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
        to: recipients,
        subject: `Petty Cash (${account}) - Transactions Reimbursed!`,
        text: `Transactions have been reimbursed for (${account})! Log in to Quickbooks view transactions.`,
        html: `<b>Transactions have been reimbursed for (${account}).</b>`,
    };
    return emailTemplate;
};

// /**
//  * 
//  * @param {string} account 
//  */
// const transactionDeletedEmailTemplate = (account) => {

//     const deletedRecipients = {
//         procurement: 'procurement.coor@muneshwers.com, procurement.clerk@muneshwers.com, procurement.clerk2@muneshwers.com, procurement.supv@muneshwers.com, fin.acct@muneshwers.com',
//         meals: 'acc.snrclerk@muneshwers.com'
//     };

//     let recipients = deletedRecipients[account];
//     if (!recipients) { recipients = deletedRecipients['procurement']; }
//     const emailTemplate = {
//         from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
//         to: recipients,
//         subject: `Petty Cash (${account}) - Transactions Deleted!`,
//         text: `Warning! A transaction has been deleted. For more information look at History page.`,
//         html: `<b>Transaction Deleted for (${account}).</b>`,
//     };
//     return emailTemplate;
// };

async function transactionDeletedEmailTemplate(account) {
    const link = await uploadToDrive(auth, './server/receipts.jpg', 'receipts.jpg', account);

    const emailTemplate = {
        from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
        to: 'programmer@muneshwers.com',
        subject: `Petty Cash (${account}) - Transactions Deleted!`,
        text: `Warning! A transaction has been deleted. For more information look at the History page. Link to folder: ${link}`,
        html: `<b>Transaction Deleted for (${account}).</b> Link to folder: <a href="${link}">${link}</a>`
    };

    return emailTemplate;
}


async function createDriveFolder(auth, folderName) {
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


async function uploadToDrive(auth, filePath, fileName, account) {
    const currentDate = format(new Date(), 'yyyy-MM-dd');
    const folderName = `Reimbursements for ${account} - ${currentDate}`;
    const folderId = await createDriveFolder(auth, folderName);

    const drive = google.drive({ version: 'v3', auth });
    const fileMetadata = {
        'name': fileName,
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


function sendEmailFactory(templateBuilder) {
    return async function(account) {
        if (!emailsOn) return;
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    user: 'programmers.muneshwers@gmail.com',
                    pass: 'dcmdgjlbkxsgpysi',
                },
            });
            let template = await templateBuilder(account);
            const info = await transporter.sendMail(template);
            console.log('Message sent: %s', info.messageId);

        } catch (error) {
            console.error('Error occurred while sending email:', error);
        }
    }
}

function timeOutFunctionCall(func) {
    let timeouts = {};
    return async function(key) {
        let timeout = timeouts[key];
        if (timeout) return;
        func(key);
        timeouts[key] = true;
        setTimeout(() => timeouts[key] = false, 3 * 60 * 60 * 1000);
    }
}

export const sendNearingLimitEmailWithTimout = timeOutFunctionCall(sendEmailFactory(nearingLimitEmailTemplate));
export const sendTransactionForApprovalEmailWithTimeout = timeOutFunctionCall(sendEmailFactory(transactionMadeEmailTemplate));
export const sendApprovalMadeEmailWithTimeout = timeOutFunctionCall(sendEmailFactory(approvalMadeEmailTemplate));
export const sendReimbursementsMadeWithTimeout = timeOutFunctionCall(sendEmailFactory(reimbursementsMadeEmailTemplate));
export const sendTransactionDeletedEmail = sendEmailFactory(transactionDeletedEmailTemplate);
