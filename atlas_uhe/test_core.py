import unittest
from core import extract,qualify,expected_value,layout,boq,audit
R={k:5 for k in ('scope_fit','commercial','competition','client','delivery','effort','strategy')}
class Tests(unittest.TestCase):
 def test_extract(self):
  x=extract('Must submit plan\fيجب تقديم المخطط','RFP.txt')
  self.assertEqual(len(x),2);self.assertEqual(x[1]['page'],2)
 def test_gates(self):
  self.assertEqual(qualify({'license':True},R)['score'],100)
  self.assertEqual(qualify({'license':False},R)['eligibility'],'NO_BID')
  self.assertEqual(qualify({'license':None},R)['eligibility'],'REVIEW')
 def test_ev(self):self.assertEqual(expected_value('.6','150000','5000'),'85000.00')
 def test_geometry(self):
  x=layout(25,20,8,4,6,7,'.55','.9',2)
  self.assertEqual(x['seats'],84);self.assertTrue(x['rectangle_fit'])
 def test_boq(self):
  x=boq([dict(description='stage',unit='m2',rate_source='estimate',rate_status='unconfirmed',quantity=32,selling_rate_aed=100)])
  self.assertEqual(x['total_aed'],'3360.00')
 def test_audit(self):
  self.assertEqual(audit([],qualify({'license':True},R),{}, {})['release'],'BLOCKED')
if __name__=='__main__':unittest.main()
