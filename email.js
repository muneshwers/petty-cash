import nodemailer from "nodemailer"

const nearingLimitEmailTemplate = {
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'programmer@muneshwers.com',
    subject: 'Petty Cash - Nearing account limit. Reimburse as soon as possible!',
    text: 'Nearing account limit. Reimburse as soon as possible!',
    html: '<b>Nearing account limit. Reimburse as soon as possible!</b>',
}

const transactionMadeEmailTemplate = {
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'programmer@muneshwers.com',
    subject: 'Petty Cash - New Transactions Made',
    text: 'New Transaction were made. Log in to Approve!',
    html: '<b>New Transaction were made. Log in to Approve!</b>',
}

const approvalMadeEmailTemplate = {
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'programmer@muneshwers.com',
    subject: 'Petty Cash - Transactions Approved!',
    text: 'Your transactions have been approved! Log in to reimburse.',
    html: '<b>Your transactions have been approved! Log in to reimburse.</b>',
}

const reimbursementsMadeEmailTemplate = {
    from: '"Petty Cash Bot" <programmers.muneshwers@gmail.com>',
    to: 'programmer@muneshwers.com',
    subject: 'Petty Cash - Transactions Reimbursed!',
    text: 'Transactions have been reimburse! Log in to Quickbooks view transactions.',
    html: '<b>Transactions have been reimbursed.</b>',
}
function sendEmailFactory(template) {
    return async function(){
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
        func()
        timeouts[key] = true
        setTimeout(() => timeouts[key] = false, 3 * 60 * 60 * 1000)
    }
}

export const sendNearingLimitEmailWithTimout= timeOutFunctionCall(sendEmailFactory(nearingLimitEmailTemplate))
export const sendtransactionMadeEmailWithTimeout = timeOutFunctionCall(sendEmailFactory(transactionMadeEmailTemplate))
export const sendApprovalMadeEmailWithTimeout = timeOutFunctionCall(sendEmailFactory(approvalMadeEmailTemplate))
export const sendReimbursementsMadeWithTimeout = timeOutFunctionCall(sendEmailFactory(reimbursementsMadeEmailTemplate))