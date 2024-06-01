import nodemailer from "nodemailer"
import config from "../config.js"
import * as Email from "./database_functions.js"
let {emailsOn} = config

let webLink = "https://petty-cash-dot-projectservers.ue.r.appspot.com"

/**
 * 
 * @param {string} account
 * @param {Object} options
 * @returns 
 */
const nearingLimitEmailTemplate = async (account, options) => { 
    let recipients = await Email.getRecipients(account, 'nearingLimit')
    return {
        from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
        to: recipients,
        subject: `Petty Cash (${account}) - Nearing account limit. Reimburse as soon as possible!`,
        text: `Nearing account limit for (${account}). Reimburse as soon as possible! Web link : ${webLink}`,
        html: `Nearing account limit for (${account}). Reimburse as soon as possible! Web link : ${webLink}`,
    }
}

/**
 * 
 * @param {string} account 
 * @param {Object} options
 * @returns 
 */
const transactionMadeEmailTemplate = async (account, options) => {
    let recipients = await Email.getRecipients(account, 'transactionMade')
    return {
        from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
        to: recipients,
        subject: `Petty Cash (${account}) - New Transactions Made`,
        text: `New Transaction were made (${account}). Log in to Approve! ${webLink}`,
        html: `New Transaction were made (${account}). Log in to Approve! ${webLink}`,
    }
}

/**
 * 
 * @param {string} account 
 * @param {Object} options
 */
const approvalMadeEmailTemplate = async (account, options) => {
    const recipients = await Email.getRecipients(account, 'approvalMade')
    const emailTemplate = {
            from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
            to: recipients,
            subject:`Petty Cash (${account}) - Transactions Approved!`,
            text: `Your transactions have been approved for (${account})! Log in to reimburse. ${webLink}`,
            html:`Your transactions have been approved for (${account})! Log in to reimburse. ${webLink}`,
        };
    return emailTemplate;
}

/**
 * 
 * @param {string} account 
 * @param {Object} options
 */
const reimbursementsMadeEmailTemplate = async (account, options) => {
    let recipients = await Email.getRecipients(account, 'reimbursementsMade')
    return {
        from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
        to: recipients,
        subject: `Petty Cash (${account}) - Transactions Reimbursed!`,
        text: `Transactions have been reimbursed for (${account})! Log in to Petty Cash to sign reimbursements. ${webLink}`,
        html: `Transactions have been reimbursed for (${account})! Log in to Petty Cash to sign reimbursements. ${webLink}`,
    }
}

/**
 * @param {string} account 
 * @param {Object} options
 */
const transactionDeletedEmailTemplate = async (account, options) => {
    let recipients = await Email.getRecipients(account, 'transactionDeleted')
    const emailTemplate = {
            from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
            to: recipients,
            subject: `Petty Cash (${account}) - Transactions Deleted!`,
            text: `Warning! A transaction has been deleted. For more information look at History page. Web link: ${webLink}`,
            html: `Warning! A transaction has been deleted. For more information look at History page. Web link: ${webLink}`,
        };
    return emailTemplate;
}

/**
 * 
 * @param {string} account
 * @param {Object} options
 */
const transactionSignedEmailTemplate = async (account, options) => {

    try {
        let {folderLink} = options
        folderLink = folderLink ?? "" 
        let recipients = await Email.getRecipients(account, 'transactionSigned')
        const emailTemplate = {
            from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
            to: recipients,
            subject: `Petty Cash (${account}) - Transactions Reimbursed!`,
            text: `Reimbursements have been signed for (${account})! Log in to Quickbooks to view transactions. Folder Link: ${folderLink}`,
            html: `Reimbursements have been signed for (${account})! Log in to Quickbooks to view transactions. Folder Link: ${folderLink}`
        };

        return emailTemplate;
    } catch (error) {
        console.error('Error uploading file to Google Drive:', error);
    }
};

function sendEmailFactory(templateBuilder) {
    return async function(account, options){
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
            let template = await templateBuilder(account, options)
            const info = await transporter.sendMail(template);
            console.log('Message sent: %s', info.messageId);

        } catch (error) {
            console.error('Error occurred while sending email:', error);
        }
    }
}

function timeOutFunctionCall(func) {
    let timeouts = {}
    return async function(key, options) {
        let timeout = timeouts[key]
        if (timeout) return
        func(key, options)
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
