import fs from "fs"
import nodemailer from "nodemailer"
import config from "../config.js"
import { uploadFileInDriveFolder } from './gdrive.js'
import { createDriveFolder } from './gdrive.js'
import * as path from "path"

let {emailsOn, mode} = config

const nearingLimitEmailTemplate = (account) => { 
    let recipients = (mode == 'development') ? 'programmers.muneshwers@gmail.com' : 'procurement.coor@muneshwers.com, \
    procurement.clerk@muneshwers.com, \
    procurement.clerk2@muneshwers.com, \
    procurement.supv@muneshwers.com'
    return {
        from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
        to: recipients,
        subject: `Petty Cash (${account}) - Nearing account limit. Reimburse as soon as possible!`,
        text: `Nearing account limit for (${account}). Reimburse as soon as possible!`,
        html: `<b>Nearing account limit for (${account}). Reimburse as soon as possible!</b>`,
    }
}

const transactionMadeEmailTemplate = (account) => {
    let recipients = (mode == 'development') ? 'programmers.muneshwers@gmail.com' : 'fin.acct@muneshwers.com'
    return {
        from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
        to: recipients,
        subject: `Petty Cash (${account}) - New Transactions Made`,
        text: `New Transaction were made (${account}). Log in to Approve!`,
        html: `<b>New Transaction were made for (${account}). Log in to Approve!</b>`,
    }
}

/**
 * 
 * @param {string} account 
 */
const approvalMadeEmailTemplate = (account) => {

    const recipientsMap = {
        procurement : 'procurement.coor@muneshwers.com, procurement.clerk@muneshwers.com, procurement.clerk2@muneshwers.com, procurement.supv@muneshwers.com',
        meals : 'acc.snrclerk@muneshwers.com'
    };

    const recipients = (mode == 'development') ? 'programmers.muneshwers@gmail.com' : recipientsMap[account] ?? recipientsMap['procurement']
    const emailTemplate = {
            from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
            to: recipients,
            subject:`Petty Cash (${account}) - Transactions Approved!`,
            text: `Your transactions have been approved for (${account})! Log in to reimburse.`,
            html:`<b>Your transactions have been approved for (${account})! Log in to reimburse.</b>`,
        };
    return emailTemplate;
};

const reimbursementsMadeEmailTemplate = (account) => {
    let recipients = (mode == 'development') ? 'programmers.muneshwers@gmail.com' : 'gm@muneshwers.com'
    return{
        from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
        to: recipients,
        subject: `Petty Cash (${account}) - Transactions Reimbursed!`,
        text: `Transactions have been reimbursed for (${account})! Log in to Petty Cash to sign reimbursements.`,
        html: `<b>Transactions have been reimbursed for (${account}).</b>`,
    }
}

/**
 * 
 * @param {string} account 
 */
const transactionDeletedEmailTemplate = (account) => {

    const recipientsMap = {
        procurement : 'procurement.coor@muneshwers.com, procurement.clerk@muneshwers.com, procurement.clerk2@muneshwers.com, procurement.supv@muneshwers.com, fin.acct@muneshwers.com',
        meals : 'acc.snrclerk@muneshwers.com'
    };

    let recipients = (mode == 'development') ? 'programmers.muneshwers@gmail.com' : recipientsMap[account] ?? recipientsMap['procurement']

    const emailTemplate = {
            from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
            to: recipients,
            subject: `Petty Cash (${account}) - Transactions Deleted!`,
            text: `Warning! A transaction has been deleted. For more information look at History page.`,
            html: `<b>Transaction Deleted for (${account}).</b>`,
        };
    return emailTemplate;
}

/**
 * 
 * @param {string} account 
 * @returns {Promise<Object>}
 */
const transactionSignedEmailTemplate = async (account) => {
    const folderName = `${account}-reimbursements`;
    const directoryPath = './tmp/uploads';

    try {
        const { folderId, folderLink } = await createDriveFolder(folderName);
        const files = fs.readdirSync(directoryPath);
        const uploadPromises = files.map(async (file) => {
            const filePath = path.join(directoryPath, file);
            return uploadFileInDriveFolder(filePath, file, folderId);
        });

        
        const signedRecipients = {
            barges: 'accounts.sup@bargesolutionsgy.com',
            muneshwers: 'mngt.acct@muneshwers.com',
            paragon: 'accounts.sup@paragon-transportation.com',
            meals: 'acc.snrclerk@muneshwers.com'
        };

        const recipients = (mode == 'development') ? 'programmers.muneshwers@gmail.com' : signedRecipients[account];
        const emailTemplate = {
            from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
            to: recipients,
            subject: `Petty Cash (${account}) - Transactions Reimbursed!`,
            text: `Reimbursements have been signed for (${account})! Log in to Quickbooks to view transactions. Folder Link: ${folderLink}`,
            html: `<b>Reimbursements have been signed for (${account}).</b> Folder Link: <a href="${folderLink}">${folderLink}</a>`
        };

        return emailTemplate;
    } catch (error) {
        console.error('Error uploading file to Google Drive:', error);
        throw new Error('Failed to create email template with Google Drive links');
    }
};

function sendEmailFactory(templateBuilder) {
    return async function(account){
        if (!emailsOn) return
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
            let template = await templateBuilder(account)
            const info = await transporter.sendMail(template);
            console.log('Message sent: %s', info.messageId);

        } catch (error) {
            console.error('Error occurred while sending email:', error);
        }
    }
}

function timeOutFunctionCall(func) {
    let timeouts = {}
    return async function(key) {
        let timeout = timeouts[key]
        if (timeout) return
        func(key)
        timeouts[key] = true
        setTimeout(() => timeouts[key] = false, 3 * 60 * 60 * 1000)
    }
}

export const sendNearingLimitEmailWithTimout= timeOutFunctionCall(sendEmailFactory(nearingLimitEmailTemplate))
export const sendTransactionForApprovalEmailWithTimeout = timeOutFunctionCall(sendEmailFactory(transactionMadeEmailTemplate))
export const sendApprovalMadeEmailWithTimeout = timeOutFunctionCall(sendEmailFactory(approvalMadeEmailTemplate))
export const sendReimbursementsMadeWithTimeout = timeOutFunctionCall(sendEmailFactory(reimbursementsMadeEmailTemplate))
export const sendTransactionDeletedEmail = sendEmailFactory(transactionDeletedEmailTemplate)
export const sendTransactionSignedEmail = timeOutFunctionCall(sendEmailFactory(transactionSignedEmailTemplate))
