require('dotenv').config();
const fs = require('fs');

const setEnvValues = (baseURL) => {
    if (baseURL) {
        const envFilePath = '.env';
        let envContent = fs.readFileSync(envFilePath, 'utf-8');

        envContent = envContent.replace(/BASEURL=.*/, `BASEURL=${baseURL}`);

        fs.writeFileSync(envFilePath, envContent);
    }
};

const getBaseURL = () => {
    const envFilePath = '.env';
    const envContent = fs.readFileSync(envFilePath, 'utf-8');
    const match = envContent.match(/BASEURL=(.*)/);
    return match ? match[1] : null;
};

module.exports = {
    setEnvValues, getBaseURL
};