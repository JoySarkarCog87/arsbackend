const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const uuid = require('uuid')

const conn = mysql.createConnection({
    host:"localhost",
    user:"root",
    password:"root",
    database:"arsdb"
})

conn.connect(()=>{
    console.log("Database connected.");
})

const app = express();
app.use(express.json());
app.use(cors({origin:"*"}));


app.get("/", (req, res)=>{
    res.send({message:"welcome"});
})

app.post("/login", (req, res)=>{
    const {email,password} = req.body;
    conn.query("select * from user_table where email = ?",[email],(err, result)=>{
        if(err){
            console.log(err);
            res.status(400).json({status:false,user:{}});
        }else{
            if(result[0].password===password){
                const user = result[0];
                res.status(200).json({status:true,user});
            }else{
                res.status(400).json({status:false,user:{}});
            }
        }
    })
})

app.post("/register",(req, res)=>{
    const udata = {cid:generateId(),...req.body};
    conn.query("insert into user_table values(?,?,?,?,?,?,?,?,?,?)",[udata.cid,udata.name,udata.email,udata.password,udata.gender,udata.dob,udata.address,udata.phone,udata.ssnType,udata.ssnNumber],(err, _)=>{
        if(err){
            res.json({status:false});
        }else{
            res.json({status:true});
        }
    })
    
})


app.put("/update", (req, res)=>{
    const { cid, name, email, password, gender, dob, address, phone, ssnType, ssnNumber } = req.body;
    conn.query("update user_table set name=?,email=?,password=?,gender=?,dob=?,address=?,phone=?,ssnType=?,ssnNumber=? where cid=?",[name, email, password, gender, dob, address, phone, ssnType, ssnNumber,cid],(err, result)=>{
        if(err){
            console.log(err);
            res.status(400).json({status:false});
        }else{
            res.status(200).json({status:true});
        }
    })
})


app.get("/locations",(req, res)=>{
    conn.query("select distinct departsFrom,arrives from flight_det", (err, result)=>{
        if(err){
            console.log(err);
            res.status(400).json({status:false,data:[]});
        }else{
            if(result.length>0){
                let locSet = new Set();
                result.forEach(v=>{
                    locSet.add(v.departsFrom);
                    locSet.add(v.arrives)
                });
                let data = Array.from(locSet);
                res.status(200).json({status:true, data});
            }else{
                res.status(400).json({status:true, data:[]});
            }
        }
    })
})

app.get("/search",(req, res)=>{
    // console.log(req.query);
    const { departureDate, departureTime, goingTo, leavingForm } = req.query;
    const dateTime = departureDate+" "+departureTime;
    conn.query("select * from flight_det where departsFrom=? and arrives=? and departureTime>?",[leavingForm,goingTo,dateTime], (err, result)=>{
        if(err){
            // console.log(err);
            res.status(400).json({status:false,flights:[]})
        }else{
            // console.log(result);
            res.status(200).json({status:true,flights:result})
        }
    })
})

app.get("/getSeats/:flightId", (req, res)=>{
    const { flightId } = req.params;
    conn.query("select available_seat from flight_seat_table where flight=?",[flightId],(err, result)=>{
        if(err){
            res.status(400).json({status:false,ava:0});
        }else{
            if(result[0]!=undefined){
                res.status(200).json({status:true,ava:result[0].available_seat});
            }else{
                res.status(404).json({status:false,ava:0});
            }
        }
    })
})

app.get("/ticket/:userId", (req, res)=>{
    const { userId }=req.params;
    conn.query("select u.name,f.flight,f.airlinesName,f.departsFrom,f.departureTime,f.arrives,f.arrivalTime,t.id,t.totalSeats,t.seatNos,t.totalAmount,t.gateNo from ticket_det as t join user_table as u join flight_det as f on t.user_id=u.cid and t.flight_id=f.flight where u.cid=?",[userId],(err, result)=>{
        if(err){
            res.status(400).json({status:false,result:{}});
        }else{
            if(result[0]!=undefined){
                res.status(200).json({status:true,result});
            }else{
                res.status(404).json({status:false,result:[]});
            }
        }
    })
})

app.post("/bookTicket", (req, res)=>{
    const tid = generateId();
    const {userId,flightId,totalSeats,totalAmount,availableSeats} = req.body;
    conn.query("insert into ticket_det values (?,?,?,?,?,?,?)",[tid,userId,flightId,totalSeats,generateSeat(availableSeats,totalSeats),totalAmount,generateGateNumber()], (err,result)=>{
        if(err){
            console.log(err);
            res.status(400).json({status:false});
        }else{
            if(result.affectedRows>0 && availableSeats-totalSeats>=0){
                conn.query("update flight_seat_table set available_seat=? where flight=?",[availableSeats-totalSeats,flightId],(err, seatresult)=>{
                    if(err){
                        console.log(err);
                        res.status(400).json({status:false});
                    }else{
                        if(seatresult.affectedRows>0){
                            res.status(200).json({status:true});
                        }else{
                            res.status(400).json({status:false});
                        }
                    }
                })
            }else{
                res.status(400).json({status:false});
            }
        }
    })
})

app.delete("/deleteTicket/:id", (req, res)=>{
    const { id } = req.params;
    conn.query("delete from ticket_det where id=?",[id],(err, result)=>{
        if(err){
            res.status(400).send({status:false});
        }else{
            if(result.affectedRows>0){
                res.status(200).json({status:true});
            }else{
                res.status(400).json({status:false});
            }
        }
    })
})

const generateId = ()=>{
    return uuid.v4();
}

const generateSeat=(availableSeats,totalSeats)=>{
    let seatArr = ['A','B','C','D','E','F'];
    let seats = "";
    for(let i=0; i<totalSeats; i++){
        seats+=(availableSeats+""+seatArr[i]+",");
    }
    return seats.substring(0,seats.length-1);
}

const generateGateNumber = ()=>{
    return 'G'+Math.round(Math.random()*30);
}

app.listen(8000,()=>{
    console.log("Server run on port : 8000");
})