const mongoose = require('mongoose');

const connectToMongoDB = async () => {
  const databaseURI = 'mongodb://adminwuris:wurisadmin@192.168.75.58:27017/';
  const dbName = 'wurisdb';
  try {
    await mongoose.connect(databaseURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: dbName
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error(err);
  }
};

module.exports = connectToMongoDB;