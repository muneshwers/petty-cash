import "dotenv/config"

const config = {
    development : {
        mode : 'development',
        database : 'Mock',
        emailsOn : false
    },
    production : {
        mode : 'production',
        database :'Database',
        emailsOn : true
    }
}
const environment= process.env.NODE_ENV || 'development'
export default config[environment]