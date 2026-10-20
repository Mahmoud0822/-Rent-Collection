import { prisma } from '@/lib/prisma'
import { actor,errorResponse,HttpError,requireRole } from '@/lib/auth'

export async function GET(req:Request){
  try{
    const user=await actor();requireRole(user,'manager','staff')
    const url=new URL(req.url),from=url.searchParams.get('from')??'',to=url.searchParams.get('to')??''
    const valid=/^\d{4}-(0[1-9]|1[0-2])$/
    if(!valid.test(from)||!valid.test(to)||from>to)throw new HttpError(400,'Invalid month range')
    const start=new Date(`${from}-01T00:00:00+08:00`).toISOString()
    const [year,month]=to.split('-').map(Number);const next=month===12?`${year+1}-01`:`${year}-${String(month+1).padStart(2,'0')}`
    const end=new Date(`${next}-01T00:00:00+08:00`).toISOString()
    const rows=await prisma.$queryRaw<{month:string;collected:bigint}[]>`
      SELECT to_char(timezone('Asia/Kuala_Lumpur', received_at), 'YYYY-MM') AS month,
             SUM(amount_sen)::bigint AS collected
      FROM payments
      WHERE org_id=${user.orgId}::uuid AND status='approved'
        AND received_at >= ${start}::timestamptz AND received_at < ${end}::timestamptz
      GROUP BY 1 ORDER BY 1`
    const totals=new Map(rows.map(r=>[r.month,r.collected]))
    const result=[]
    let [y,m]=from.split('-').map(Number),[endY,endM]=to.split('-').map(Number)
    while(y<endY||(y===endY&&m<=endM)){const key=`${y}-${String(m).padStart(2,'0')}`;result.push({month:key,collectedSen:Number(totals.get(key)??0n)});if(++m===13){m=1;y++}}
    return Response.json(result)
  }catch(e){return errorResponse(e)}
}
