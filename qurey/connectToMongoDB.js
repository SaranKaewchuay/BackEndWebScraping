const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const setEnvValues = async (databaseURI) => {
  if (databaseURI) {
    const envFilePath = path.join(__dirname, '..', 'config.json');
    try {
      let envContent = fs.readFileSync(envFilePath, 'utf-8');
      const envConfig = JSON.parse(envContent);

      envConfig.DATABASE_URI = databaseURI;
      fs.writeFileSync(envFilePath, JSON.stringify(envConfig, null, 2));

      return envConfig.DATABASE_URI;
    } catch (error) {
      console.error('Error reading or writing config file:', error.message);
      return null;
    }
  }
};

const getDBURL = () => {
  const envFilePath = path.join(__dirname, '..', 'config.json');
  try {
    const envContent = fs.readFileSync(envFilePath, 'utf-8');
    const envConfig = JSON.parse(envContent);
    return envConfig.DATABASE_URI || null;
  } catch (error) {
    console.error('Error reading config file:', error.message);
    return null;
  }
};

const getDBName = () => {
  const envFilePath = path.join(__dirname, '..', 'config.json');
  try {
    const envContent = fs.readFileSync(envFilePath, 'utf-8');
    const envConfig = JSON.parse(envContent);
    return envConfig.DB_NAME || null;
  } catch (error) {
    console.error('Error reading config file:', error.message);
    return null;
  }
};

const connectToMongoDB = async (databaseURI) => {
  let envDbName;
  let envDatabaseURI;

  if (databaseURI) {
    envDatabaseURI = await setEnvValues(databaseURI);
  } else {
    envDbName = getDBName();
    envDatabaseURI = getDBURL();
  }
  
  try {
    await mongoose.disconnect();

    await mongoose.connect(envDatabaseURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: envDbName,
    });

    console.log('Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    return false;
  }
};


module.exports = { connectToMongoDB, getDBURL };