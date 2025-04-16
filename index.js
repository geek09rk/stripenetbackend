const express = require ('express')
const cors = require ('cors')
const connectDB = require('./src/db')

const app = express()
const apiPort = 3865
const routes =require('./src/routes/wheat-route')
app.use(express.urlencoded({extended:true}))
app.use(cors("*"))
app.use(express.json())

connectDB.on('error', console.error.bind(console, 'MongoDB connection error:'))


app.use("/api", routes)

app.listen(apiPort, ()=> console.log(`Server runnning on port ${apiPort}`))
