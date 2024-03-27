import nodemailer from "nodemailer"

const nearingLimitEmailTemplate = {
    from: '"David Callender" <programmers.muneshwers@gmail.com>',
    to: 'programmer@muneshwers.com',
    subject: 'Petty Cash - Nearing account limit. Reimburse as soon as possible!',
    text: 'Nearing account limit. Reimburse as soon as possible!',
    html: '<b>Nearing account limit. Reimburse as soon as possible!</b>',
}

const transactionMadeEmailTemplate = {
    from: '"David Callender" <programmers.muneshwers@gmail.com>',
    to: 'programmer@muneshwers.com',
    subject: 'Petty Cash - New Transactions Made',
    text: 'New Transaction were made. Log in to Approve!',
    html: '<b>New Transaction were made. Log in to Approve!</b>',
}

const approvalMadeEmailTemplate = {
    from: '"David Callender" <programmers.muneshwers@gmail.com>',
    to: 'programmer@muneshwers.com',
    subject: 'Petty Cash - Transactions Approved!',
    text: 'Your transactions have been approved! Log in to reimburse.',
    html: '<b>Your transactions have been approved! Log in to reimburse.</b>',
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
    let timeout = true
    return async function() {
        if (!timeout) return
        func()
        timeout = null
        setTimeout(() => timeout = true, 3 * 60 * 60 * 1000)
    }
}

export const sendNearingLimitEmailWithTimout= timeOutFunctionCall(sendEmailFactory(nearingLimitEmailTemplate))
export const sendtransactionMadeEmailWithTimeout = timeOutFunctionCall(sendEmailFactory(transactionMadeEmailTemplate))
export const sendApprovalMadeEmailWithTimeout = timeOutFunctionCall(sendEmailFactory(approvalMadeEmailTemplate))
