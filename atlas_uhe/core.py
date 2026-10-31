from decimal import Decimal as D
import re, hashlib
WEIGHTS={'scope_fit':20,'commercial':20,'competition':15,'client':15,'delivery':15,'effort':10,'strategy':5}
def extract(text,source):
 if not source:raise ValueError('source required')
 result=[]
 for p,chunk in enumerate(text.split('\f'),1):
  for n,line in enumerate(chunk.splitlines(),1):
   s=line.strip()
   if s and len(s)<1200 and re.search(r'\b(must|shall|required|mandatory|submit|provide|deadline)\b|يجب|مطلوب|إلزامي|تقديم',s,re.I):
    result.append(dict(id=f'R-{len(result)+1:04d}',source=source,page=p,line=n,excerpt=s,sha256=hashlib.sha256(text.encode()).hexdigest(),status='unreviewed'))
 return result
def qualify(gates,ratings):
 if not gates or any(type(v) not in (bool,type(None)) for v in gates.values()):raise ValueError('invalid gates')
 if set(ratings)!=set(WEIGHTS) or any(type(v)!=int or not 1<=v<=5 for v in ratings.values()):raise ValueError('invalid ratings')
 return dict(eligibility='NO_BID' if False in gates.values() else 'REVIEW' if None in gates.values() else 'ELIGIBLE',score=float(sum(D(WEIGHTS[k])*D(ratings[k])/5 for k in WEIGHTS)),score_is_probability=False)
def expected_value(probability,contribution,bid_cost):
 p,c,b=map(lambda x:D(str(x)),(probability,contribution,bid_cost))
 if not 0<=p<=1 or min(c,b)<0:raise ValueError('invalid EV')
 return str((p*c-b).quantize(D('.01')))
def layout(room_width,room_depth,stage_width,stage_depth,rows,seats_per_bank,seat_pitch,row_pitch,aisle_width):
 rw,rd,sw,sd,sp,rp,aw=map(lambda x:D(str(x)),(room_width,room_depth,stage_width,stage_depth,seat_pitch,row_pitch,aisle_width))
 if min(rw,rd,sw,sd,sp,rp,aw)<=0 or type(rows)!=int or type(seats_per_bank)!=int or min(rows,seats_per_bank)<=0:raise ValueError('invalid geometry')
 return dict(stage_area_m2=str(sw*sd),seats=2*rows*seats_per_bank,rectangle_fit=sw<=rw and sd+rows*rp<=rd and 2*seats_per_bank*sp+aw<=rw,status='SCHEMATIC_UNVERIFIED',unverified=['egress','accessibility','sightlines','venue survey'])
def boq(lines,vat='0.05'):
 if not lines:raise ValueError('empty BOQ')
 total=D(0)
 for x in lines:
  if not all(x.get(k) for k in ('description','unit','rate_source','rate_status')):raise ValueError('missing provenance')
  q,r=D(str(x['quantity'])),D(str(x['selling_rate_aed']))
  if min(q,r)<0:raise ValueError('negative price or quantity')
  total+=(q*r).quantize(D('.01'))
 v=D(str(vat))
 if not 0<=v<=1:raise ValueError('invalid VAT')
 return dict(subtotal_aed=str(total),vat_aed=str((total*v).quantize(D('.01'))),total_aed=str(total+(total*v).quantize(D('.01'))),status='DRAFT_UNAPPROVED')
def audit(requirements,qualification,geometry,commercial):
 blockers=[]
 if not requirements or any(r['status']!='verified' for r in requirements):blockers.append('unverified requirements')
 if qualification['eligibility']!='ELIGIBLE':blockers.append('eligibility not confirmed')
 if geometry.get('status')!='APPROVED':blockers.append('geometry not approved')
 if commercial.get('status')!='APPROVED':blockers.append('commercial not approved')
 blockers.extend(['verified templates missing','visual QA missing','authorized sign-off missing'])
 return dict(release='BLOCKED',blockers=blockers)
