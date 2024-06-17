import "dotenv/config"

const config = {
    development : {
        mode : 'development',
        database : 'Mock',
        emailsOn : true,
        adaptorServerUrl :  "https://adaptor-server-csi5xpfnxa-rj.a.run.app/pettycash/test/reimbursements",
        buckName : 'mock_project_server'
    },
    production : {
        mode : 'production',
        database :'Database',
        emailsOn : true,
        adaptorServerUrl : "https://adaptor-server-csi5xpfnxa-rj.a.run.app/pettycash/reimbursements",
        buckName : 'projectservers.appspot.com',
    }
}
const environment= process.env.NODE_ENV || 'development'
export default config[environment]