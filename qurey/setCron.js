require('dotenv').config();
const fs = require('fs');

const setEnvValues = (setCron) => {
    if (setCron) {
        const envFilePath = '.env';
        let envContent = fs.readFileSync(envFilePath, 'utf-8');

        envContent = envContent.replace(/SETCRON=.*/, `SETCRON=${setCron}`);

        fs.writeFileSync(envFilePath, envContent);
    }
    else{
        console.log("not in setEnvValues")
    }
};

const getCron = () => {
    const envFilePath = '.env';
    const envContent = fs.readFileSync(envFilePath, 'utf-8');
    const match = envContent.match(/SETCRON=(.*)/);
    return match ? match[1] : null;
};

module.exports = {
    setEnvValues, getCron
};