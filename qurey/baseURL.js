const fs = require('fs');
const path = require('path');

const setEnvValues = (baseURL) => {
    if (baseURL) {
        const envFilePath = path.join(__dirname, '..', 'config.json');
        try {
            let envContent = JSON.parse(fs.readFileSync(envFilePath, 'utf-8'));

            // Modify the BASEURL property
            envContent.BASEURL = baseURL;

            // Write the updated JSON back to the file
            fs.writeFileSync(envFilePath, JSON.stringify(envContent, null, 2));
        } catch (error) {
            console.error('Error reading or writing config file:', error.message);
        }
    }
};

const getBaseURL = () => {
    const envFilePath = path.join(__dirname, '..', 'config.json');
    try {
        const envContent = fs.readFileSync(envFilePath, 'utf-8');
        const envConfig = JSON.parse(envContent);
        return envConfig.BASEURL || null;
    } catch (error) {
        console.error('Error reading config file:', error.message);
        return null;
    }
};


module.exports = {
    setEnvValues, getBaseURL
};