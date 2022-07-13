import koa from './koa'

let app:any=new koa()
function sleep(){
  return new Promise<void>((resolve,reject)=>{
    setTimeout(()=>{
      console.log('sleep')
      resolve()
    },2000)
  })
}
/* app.use(async (ctx,next)=>{
  console.log(1)
  ctx.body='1'
  await next()
  await next()
  console.log(6)
  ctx.body='6'
})
app.use(async (ctx,next)=>{
  console.log(2)
  ctx.body='2'
  await sleep()
  await next()
  console.log(5)
  ctx.body='5'
})
app.use(async (ctx,next)=>{
  console.log(3)
  ctx.body='3'
  await next()
  console.log(4)
  ctx.body='4'
}) */
app.use(async(ctx)=>{
  ctx.body='123'
})
//捕获不到调用多次next的错误
app.on('error',(e)=>{
  console.log('********',e)
})
app.listen(3000,()=>{
  console.log('server start http://localhost:3000')
})