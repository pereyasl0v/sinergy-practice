from __future__ import annotations
import pdfplumber, json, re, sys
from decimal import Decimal
from pathlib import Path
from collections import Counter
ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1] / 'reference_pdfs'
TARGET=Path(__file__).resolve().parents[1] / 'backend/app/catalog.json'
DOCS={
 'bachelor':{'name':'prikaz_vo_bak_1kurs.pdf','number':'№ 173/3000255 от 04.09.2026','level':'bachelor','pages':[3,4,5]},
 'specialist':{'name':'prikaz_vo_spc_1kurs.pdf','number':'№ 173/3000224 от 30.07.2026','level':'specialist','pages':[3]},
 'distance':{'name':'prikaz_stoimost_zao_dist.pdf','number':'№ 173/2001300 от 20.01.2026','level':None,'pages':[3,4,5]},
}
L={'bachelor':'Бакалавриат','specialist':'Специалитет','master':'Магистратура','college':'Среднее профессиональное образование'}

def text(x):return re.sub(r'\s+',' ',x or '').strip()
def num(x):
 x=text(x)
 if not x or x in ('-','Не предусмотрено','#ЗНАЧ!'):return None
 x=x.replace(' ','')
 unit='USD' if 'USD' in x else 'RUB'
 x=x.replace('USD','')
 try: return (int(x),unit)
 except ValueError: return None

def months_from_price(y,t):
 assert y>0
 value=Decimal(t)*12/Decimal(y)
 if value!=int(value) or int(value) not in [30,36,42,48,54,60,66,72]:
  raise ValueError(f'Unrecognized duration {t}/{y} -> {value} months')
 return int(value)

programs=[]
errors=[]
with pdfplumber.open(ROOT / DOCS['bachelor']['name']) as pdf:
 for page_idx in [2,3,4]:
  tables=pdf.pages[page_idx].extract_tables(table_settings={'vertical_strategy':'lines','horizontal_strategy':'lines','snap_tolerance':4,'join_tolerance':4,'intersection_tolerance':5})
  tab=max(tables,key=len)
  mode=form=area=''
  for ridx,r0 in enumerate(tab):
   if len(r0)!=8: continue
   row=list(map(text,r0))
   if row[0].startswith('Программа обучения') or not num(row[4]):continue
   if row[0]:mode=row[0]
   if row[1]:form=row[1]
   if row[2]:area=row[2]
   title=row[3] if row[3]!='-' else area
   a, g, gt, t=map(num,row[4:])
   if not a or not t:errors.append(('bachelor',page_idx+1,ridx,row));continue
   y,currency=a;total,tcurrency=t
   assert currency==tcurrency
   duration=months_from_price(y,total)
   gy=g[0] if g else None; gtotal=gt[0] if gt else None
   if bool(gy) !=bool(gtotal): errors.append(('guarantee missing pair',row))
   elif gy and gy*duration!=gtotal*12: errors.append(('guarantee mismatch',title,duration,gy,gtotal))
   programs.append(dict(level='bachelor',training_mode=mode,study_format=form,area=area,title=title,
    prices=[{'months':duration,'year_price':y,'course_price':total,'employment_year_price':gy,'employment_course_price':gtotal}],
    currency=currency,duration_source='derived',generic=False,source='bachelor',source_page=page_idx+1))

with pdfplumber.open(ROOT / DOCS['specialist']['name']) as pdf:
 tab=max(pdf.pages[2].extract_tables(table_settings={'vertical_strategy':'lines','horizontal_strategy':'lines','snap_tolerance':4,'join_tolerance':4,'intersection_tolerance':5}),key=len)
 mode=form=area=''
 for ridx,r0 in enumerate(tab):
  row=list(map(text,r0))
  if len(row)!=8 or not num(row[4]):continue
  if row[0]:mode=row[0]
  if row[1]:form=row[1]
  if row[2]:area=row[2]
  title=row[3] if row[3]!='-' else area
  a,g,t,gt=map(num,row[4:])
  if not a or not t:errors.append(('specialist',ridx,row));continue
  y,currency=a;total,tcurrency=t
  assert currency==tcurrency
  duration=months_from_price(y,total)
  gy=g[0] if g else None; gtotal=gt[0] if gt else None
  if bool(gy)!=bool(gtotal):errors.append(('guarantee missing pair spec',row))
  elif gy and gy*duration!=gtotal*12:errors.append(('guarantee mismatch spec',title,duration,gy,gtotal))
  programs.append(dict(level='specialist',training_mode=mode,study_format=form,area=area,title=title,
   prices=[{'months':duration,'year_price':y,'course_price':total,'employment_year_price':gy,'employment_course_price':gtotal}],
   currency=currency,duration_source='derived',generic=False,source='specialist',source_page=3))

with pdfplumber.open(ROOT / DOCS['distance']['name']) as pdf:
 for page_idx,level,opts in [(2,'college',[48,60]),(3,'bachelor',[42,54]),(4,'master',[30])]:
  tab=max(pdf.pages[page_idx].extract_tables(table_settings={'vertical_strategy':'lines','horizontal_strategy':'lines','snap_tolerance':4,'join_tolerance':4,'intersection_tolerance':5}),key=len)
  for ridx,row0 in enumerate(tab):
   row=list(map(text,row0))
   if len(row)!=3 or not num(row[1]):continue
   label,amount,full=row
   a=num(amount)
   if not a:continue
   years=a[0]
   totals=[num(x.strip()) for x in full.split('/')]
   if len(totals)!=len(opts):errors.append(('distance options not matching',level,row));continue
   variants=[]
   for months,total in zip(opts,totals):
    if not total or total[0]*12 !=years*months: errors.append(('distance amount mismatch',level,label,months,years,total));continue
    variants.append(dict(months=months,year_price=years,course_price=total[0],employment_year_price=None,employment_course_price=None))
   generic=label.lower().startswith('очно-заочная с применением')
   area='Общий тариф без указания специальности' if generic else ('Специальные дистанционные программы' if not label.startswith('факультет') else label)
   programs.append(dict(level=level,training_mode='С применением дистанционных технологий',study_format='Очно-заочная (дистанционные технологии)',area=area,title=label,
    prices=variants,currency='RUB',duration_source='explicit',generic=generic,source='distance',source_page=page_idx+1))

for i,row in enumerate(programs):
 row['id']=f"{row['source'][:1]}-{row['level'][:2]}-{i+1:03d}"
 row['name']=row['title']
 row['source_order']=DOCS[row['source']]['number']

assert not errors,errors
# Specific verification checks on the parsed data
look=lambda source,title,mode_part='':next(p for p in programs if p['source']==source and p['title']==title and mode_part in p['training_mode'])
b=look('bachelor','Разработка программного обеспечения (Full-stack разработка)','классического')
assert (b['prices'][0]['year_price'],b['prices'][0]['course_price'],b['prices'][0]['employment_course_price'])==(390000,1560000,1720000)
s=look('specialist','Клинический психолог')
assert (s['prices'][0]['months'],s['prices'][0]['course_price'])==(66,1925000)
college=next(p for p in programs if p['level']=='college' and p['generic'])
assert len(college['prices'])==2 and [x['months'] for x in college['prices']]==[48,60]

catalog={'academic_year':'2026/2027','catalog_description':'Только тарифные позиции из трёх приложенных приказов, а не полный каталог специальностей университета.',
         'levels':[{'id':key,'name':name,'count':sum(p['level']==key for p in programs)} for key,name in L.items()],
         'source_documents':{k:{'filename':d['name'],'order':d['number'],'pages':d['pages']} for k,d in DOCS.items()},
         'programs':programs}
TARGET.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('TOTAL',len(programs),'levels',Counter(p['level'] for p in programs),'sources',Counter(p['source'] for p in programs))
print('DURATIONS',Counter((p['level'], q['months']) for p in programs for q in p['prices']))
print('TARIFS WITHOUT EXACT SPECIALTY',sum(p['generic'] for p in programs))
print('SAMPLE:',b,'\nCOLLEGE:',college)
