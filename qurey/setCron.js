const fs = require('fs');
const path = require('path');

const setEnvValues = (setCron) => {
    if (setCron !== undefined) {
        const envFilePath = path.join(__dirname, '..', 'config.json');
        try {
            let envContent = JSON.parse(fs.readFileSync(envFilePath, 'utf-8'));

            envContent.SETCRON = setCron;

            fs.writeFileSync(envFilePath, JSON.stringify(envContent, null, 2));
        } catch (error) {
            console.error('Error reading or writing config file:', error.message);
        }
    }
    else {
        console.log("not in setEnvValues")
    }
};

const getCron = () => {
    const envFilePath = path.join(__dirname, '..', 'config.json');
    try {
        const envContent = fs.readFileSync(envFilePath, 'utf-8');
        const config = JSON.parse(envContent);
        return config.SETCRON || null;
    } catch (error) {
        console.error('Error reading config file:', error.message);
        return null;
    }
};


module.exports = {
    setEnvValues, getCron
};