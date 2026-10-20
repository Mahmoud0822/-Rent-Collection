import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { generateSchedule } from '../lib/billing'
import { allocate, lockLease } from '../lib/allocation'

const prisma = new PrismaClient()
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
const password = 'RentTest2026!'

const accounts = [
  ['Northwind Properties','manager@northwind.test','manager','manager'],
  ['Northwind Properties','staff@northwind.test','staff','staff'],
  ['Northwind Properties','aisyah@northwind.test','tenant','Aisyah Rahman'],
  ['Northwind Properties','ben@northwind.test','tenant','Ben Lim'],
  ['Northwind Properties','probe@northwind.test','tenant','Probe Tenant'],
  ['Beta Realty','manager@beta.test','manager','manager'],
  ['Beta Realty','chen@beta.test','tenant','Chen Wei'],
] as const

function date(value:string){return new Date(`${value}T00:00:00.000Z`)}

async function main(){
  const users = new Map<string,string>()
  for(const [,email] of accounts){
    const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true})
    if(error) throw error
    users.set(email,data.user.id)
  }
  const north=await prisma.organization.create({data:{name:'Northwind Properties'}})
  const beta=await prisma.organization.create({data:{name:'Beta Realty'}})
  for(const [orgName,email,role] of accounts.filter(a=>a[2]!=='tenant')){
    const org=orgName==='Northwind Properties'?north:beta
    await prisma.membership.create({data:{userId:users.get(email)!,orgId:org.id,role:role as 'manager'|'staff'}})
  }
  const northUnits=await Promise.all(['A-12-3','B-05-1','C-01-7','D-03-2'].map(name=>prisma.unit.create({data:{orgId:north.id,name}})))
  const betaUnit=await prisma.unit.create({data:{orgId:beta.id,name:'KL-1'}})
  const tenantRows=new Map<string,{id:string;orgId:string;userId:string;fullName:string;email:string;phone:string|null}>()
  for(const [orgName,email,role,name] of accounts.filter(a=>a[2]==='tenant')){
    const org=orgName==='Northwind Properties'?north:beta
    const row=await prisma.tenant.create({data:{orgId:org.id,userId:users.get(email)!,fullName:name,email,phone:null}})
    tenantRows.set(email,row)
  }
  const leaseDefs=[
    {org:north,unit:northUnits[0],tenant:tenantRows.get('aisyah@northwind.test')!,start:'2026-01-31',end:'2026-07-15',rent:150000,deposit:300000},
    {org:north,unit:northUnits[1],tenant:tenantRows.get('ben@northwind.test')!,start:'2026-01-01',end:'2026-04-15',rent:100029,deposit:0},
    {org:north,unit:northUnits[2],tenant:tenantRows.get('probe@northwind.test')!,start:'2026-02-28',end:'2027-02-27',rent:200000,deposit:400000},
    {org:beta,unit:betaUnit,tenant:tenantRows.get('chen@beta.test')!,start:'2026-03-15',end:'2027-03-14',rent:220000,deposit:440000},
  ]
  const leases=[]
  for(const d of leaseDefs){
    const schedule=generateSchedule({startDate:d.start,endDate:d.end,monthlyRentSen:d.rent,depositSen:d.deposit})
    const lease=await prisma.$transaction(async tx=>{
      const l=await tx.lease.create({data:{orgId:d.org.id,unitId:d.unit.id,tenantId:d.tenant.id,startDate:date(d.start),endDate:date(d.end),monthlyRentSen:BigInt(d.rent),depositSen:BigInt(d.deposit)}})
      await tx.invoice.createMany({data:schedule.map(i=>({orgId:d.org.id,leaseId:l.id,kind:i.kind,periodIndex:i.periodIndex,periodStart:i.periodStart?date(i.periodStart):null,periodEnd:i.periodEnd?date(i.periodEnd):null,dueDate:date(i.dueDate),amountSen:BigInt(i.amountSen)}))})
      await tx.auditLog.create({data:{orgId:d.org.id,actorId:users.get(d.org===north?'manager@northwind.test':'manager@beta.test')!,action:'lease.created',entityId:l.id,details:{seed:true}}})
      return l
    })
    leases.push(lease)
  }
  const aisyahLease=leases[0]
  await prisma.$transaction(async tx=>{
    await lockLease(tx,aisyahLease.id)
    const p=await tx.payment.create({data:{orgId:north.id,leaseId:aisyahLease.id,amountSen:300000n,method:'cash',status:'approved',receivedAt:new Date('2026-01-31T02:00:00.000Z'),createdBy:users.get('manager@northwind.test')!}})
    await allocate(tx,p.id)
    await tx.auditLog.create({data:{orgId:north.id,actorId:users.get('manager@northwind.test')!,action:'payment.approved',entityId:p.id,details:{seed:true}}})
  })
  const slipPath=`${north.id}/seed/transfer-slip.pdf`
  const {error:uploadError}=await admin.storage.from('payment-slips').upload(slipPath,Buffer.from('%PDF-1.4\n% seed payment proof\n%%EOF\n'),{contentType:'application/pdf',upsert:true})
  if(uploadError) throw uploadError
  await prisma.$transaction(async tx=>{
    await lockLease(tx,aisyahLease.id)
    const pending=await tx.payment.create({data:{orgId:north.id,leaseId:aisyahLease.id,amountSen:200000n,method:'bank_transfer',status:'pending_verification',receivedAt:new Date('2026-02-28T16:30:00.000Z'),slipPath,createdBy:users.get('staff@northwind.test')!}})
    await tx.payment.update({where:{id:pending.id},data:{status:'approved'}})
    await allocate(tx,pending.id)
    await tx.auditLog.create({data:{orgId:north.id,actorId:users.get('manager@northwind.test')!,action:'payment.approved',entityId:pending.id,details:{seed:true,recordedBy:'staff'}}})
  })
  console.log(`Seeded assessment data. Shared account password: ${password}`)
}

main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>prisma.$disconnect())
