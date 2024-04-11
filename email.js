import nodemailer from "nodemailer"

const nearingLimitEmailTemplate = (account) => ({
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'procurement.coor@muneshwers.com, \
    procurement.clerk@muneshwers.com, \
    procurement.clerk2@muneshwers.com, \
    procurement.supv@muneshwers.com',
    subject: `Petty Cash (${account}) - Nearing account limit. Reimburse as soon as possible!`,
    text: `Nearing account limit for (${account}). Reimburse as soon as possible!`,
    html: `<b>Nearing account limit for (${account}). Reimburse as soon as possible!</b>`,
})

const transactionMadeEmailTemplate = (account) => ({
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'fin.acct@muneshwers.com',
    subject: `Petty Cash (${account}) - New Transactions Made`,
    text: `New Transaction were made (${account}). Log in to Approve!`,
    html: `<b>New Transaction were made for (${account}). Log in to Approve!</b>`,
})

const approvalMadeEmailTemplate = (account) => ({
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'procurement.coor@muneshwers.com, \
    procurement.clerk@muneshwers.com, \
    procurement.clerk2@muneshwers.com, \
    procurement.supv@muneshwers.com',
    subject:`Petty Cash (${account}) - Transactions Approved!`,
    text: `Your transactions have been approved for (${account})! Log in to reimburse.`,
    html:`<b>Your transactions have been approved for (${account})! Log in to reimburse.</b>`,
})

const reimbursementsMadeEmailTemplate = (account) => ({
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'procurement.coor@muneshwers.com, \
    procurement.clerk@muneshwers.com, \
    procurement.clerk2@muneshwers.com, \
    procurement.supv@muneshwers.com',
    subject: `Petty Cash (${account}) - Transactions Reimbursed!`,
    text: `Transactions have been reimburse for (${account})! Log in to Quickbooks view transactions.`,
    html: `<b>Transactions have been reimbursed for (${account}).</b>`,
})

const transactionDeletedEmailTemplate = (account) => ({
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'procurement.coor@muneshwers.com,\
    procurement.clerk@muneshwers.com,\
    procurement.clerk2@muneshwers.com,\
    procurement.supv@muneshwers.com,\
    fin.acct@muneshwers.com',
    subject: `Petty Cash (${account}) - Transactions Deleted!`,
    text: `Warning! A transaction has been deleted. For more inform look at History page.`,
    html: `<b>Transaction Deleted for (${account}).</b>`,
})

function sendEmailFactory(templateBuilder) {
    return async function(account){
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
            let template = templateBuilder(account)
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
