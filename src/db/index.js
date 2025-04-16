const mongoose =require('mongoose')

mongoose.connect("mongodb://127.0.0.1:27017/default")
.then(console.log("Database connected"))
.catch(e => {
    console.error('Connection error', e.message)
})

module.exports = connectDB = mongoose.connection