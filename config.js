import "dotenv/config"

const config = {
    development : {
        mode : 'development',
        database : 'Mock',
        emailsOn : false,
        adaptorServerUrl :  "https://adaptor-server-csi5xpfnxa-rj.a.run.app/pettycash/test/reimbursements"
    },
    production : {
        mode : 'production',
        database :'Database',
        emailsOn : true,
        adaptorServerUrl : "https://adaptor-server-csi5xpfnxa-rj.a.run.app/pettycash/reimbursements"
    }
}
const environment= process.env.NODE_ENV || 'development'
export default config[environment]