import nodemailer from "nodemailer"

const nearingLimitEmailTemplate = {
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'procurement.coor@muneshwers.com, procurement.clerk@muneshwers.com, procurement.clerk2@muneshwers.com, procurement.supv@muneshwers.com',
    subject: (account) => `Petty Cash (${account}) - Nearing account limit. Reimburse as soon as possible!`,
    text: (account) => `Nearing account limit for (${account}). Reimburse as soon as possible!`,
    html: (account) => `<b>Nearing account limit for (${account}). Reimburse as soon as possible!</b>`,
}

const transactionMadeEmailTemplate = {
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'fin.acct@muneshwers.com',
    subject: (account) => `Petty Cash (${account}) - New Transactions Made`,
    text: (account) => `New Transaction were made (${account}). Log in to Approve!`,
    html: (account) => `<b>New Transaction were made for (${account}). Log in to Approve!</b>`,
}

const approvalMadeEmailTemplate = {
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'procurement.coor@muneshwers.com, procurement.clerk@muneshwers.com, procurement.clerk2@muneshwers.com, procurement.supv@muneshwers.com',
    subject:(account) => `Petty Cash (${account}) - Transactions Approved!`,
    text:(account) => `Your transactions have been approved for (${account})! Log in to reimburse.`,
    html:(account) => `<b>Your transactions have been approved for (${account})! Log in to reimburse.</b>`,
}

const reimbursementsMadeEmailTemplate = {
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'procurement.coor@muneshwers.com, procurement.clerk@muneshwers.com, procurement.clerk2@muneshwers.com, procurement.supv@muneshwers.com',
    subject: (account) => `Petty Cash (${account}) - Transactions Reimbursed!`,
    text: (account) => `Transactions have been reimburse for (${account})! Log in to Quickbooks view transactions.`,
    html: (account) => `<b>Transactions have been reimbursed for (${account}).</b>`,
}
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
            let template = {}
            template.from = templateBuilder.from
            template.to = templateBuilder.to
            template.subject = templateBuilder.subject(account)
            template.text = templateBuilder.text(account)
            template.html = templateBuilder.html(account)
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
export const sendtransactionMadeEmailWithTimeout = timeOutFunctionCall(sendEmailFactory(transactionMadeEmailTemplate))
export const sendApprovalMadeEmailWithTimeout = timeOutFunctionCall(sendEmailFactory(approvalMadeEmailTemplate))
export const sendReimbursementsMadeWithTimeout = timeOutFunctionCall(sendEmailFactory(reimbursementsMadeEmailTemplate))
