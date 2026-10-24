"""Rebuild the trade catalogue from the approved public image set.

Run: python tools/build_trade_catalogue.py
Dependencies: reportlab, Pillow. Product data is in collection-products.json.
Private provenance and permissions stay outside this repository.
"""
from pathlib import Path
import json
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.lib.pagesizes import A4
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'ik-v4'
PRODUCTS = json.loads((ROOT / 'tools/collection-products.json').read_text(encoding='utf8'))
OUTPUT = SITE / 'downloads/ik-eng-trade-catalogue-2026.pdf'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
W,H = A4
c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
c.setTitle('IK ENG Trade Catalogue 2026')
c.setAuthor('IK Eng Ltd')
c.setSubject('Kitchen, wardrobe and furniture product examples')
INK,TEAL,GOLD,PAPER = map(HexColor,['#16140f','#1d6b5e','#c8922a','#f8f5ef'])
LABEL = 'Example products from our partner factories. Made to your specification.'

def text(x,y,value,size=11,font='Helvetica',colour=INK):
    c.setFillColor(colour);c.setFont(font,size);c.drawString(x,y,value)

def photo(product,x,y,w,h):
    im=Image.open(SITE/'images/collection'/product['image']).convert('RGB')
    c.setFillColor(HexColor('#ffffff'));c.rect(x,y,w,h,fill=1,stroke=0)
    encoded=BytesIO();im.save(encoded,format='JPEG',quality=86,optimize=True);encoded.seek(0)
    c.drawImage(ImageReader(encoded),x,y,width=w,height=h,preserveAspectRatio=True,anchor='c')

def base(section):
    c.setFillColor(PAPER);c.rect(0,0,W,H,fill=1,stroke=0)
    text(40,H-40,'IK ENG',15,'Helvetica-Bold',TEAL)
    text(40,28,'ikeng.co.uk  |  '+section.upper(),8,colour=TEAL)
    text(W-55,28,f'{c.getPageNumber():02d}',8)

base('Trade catalogue / 2026')
text(40,H-104,'Considered spaces.',34,'Times-Roman')
text(40,H-145,'Coordinated interiors.',34,'Times-Roman')
text(40,H-180,'KITCHENS / WARDROBES / FURNITURE',10,'Helvetica-Bold',TEAL)
photo(PRODUCTS[0],40,210,W-80,390)
text(40,175,'Trade catalogue 2026',20,'Times-Roman')
text(40,146,'A starting point for your next home or property project.',11)
text(40,112,LABEL,8)
text(40,88,'Price on request. Final specification agreed before ordering.',10)
c.showPage()

base('Contents')
text(40,H-108,'Explore the collection.',32,'Times-Roman')
text(40,H-145,'Choose your references. Then tell us what you need.',11)
for y,name,pages in [(H-220,'Kitchens','03-06'),(H-300,'Wardrobes','07-09'),(H-380,'Furniture','10-14'),(H-460,'How ordering works','15')]:
    c.setStrokeColor(HexColor('#ddd8cc'));c.line(40,y-25,W-40,y-25)
    text(40,y,name,25,'Times-Roman');text(W-100,y,pages,12,colour=TEAL)
for y,line in [(270,'How to use this catalogue'),(240,'Keep the IKE codes you like and include them in your project brief.'),(218,'Share room plans, quantities, budget, postcode and required timing.'),(196,'Materials, sizes and finish options are confirmed in your quotation.'),(174,'Room accessories are included only where listed in your quotation.')]:
    text(40,y,line,12 if y==270 else 10,'Helvetica-Bold' if y==270 else 'Helvetica')
text(40,105,LABEL,8)
c.showPage()

for section in ['kitchens','wardrobes','furniture']:
    items=[p for p in PRODUCTS if p['section']==section]
    for start in range(0,len(items),2):
        base(section)
        text(40,H-88,section.title(),29,'Times-Roman')
        text(40,H-111,LABEL,8)
        for index,p in enumerate(items[start:start+2]):
            top=H-135-index*322
            photo(p,40,top-210,W-80,210)
            text(40,top-231,p['code'],10,'Helvetica-Bold',TEAL)
            text(40,top-254,p['name'],20,'Times-Roman')
            text(40,top-273,p['options'],9)
            text(40,top-292,'Price on request',10,'Helvetica-Bold')
        c.showPage()

base('How ordering works')
text(40,H-102,'From your brief to your site.',30,'Times-Roman')
steps=[('01  Share your brief',['Send your IKE references, plans, quantities, budget and timing.',
       'We provide factory options and pricing within 48 hours of a brief.']),
       ('02  Agree the specification',['Review the materials, finishes, sizes and drawings before ordering.',
       'Our 5% sourcing fee is shown on every quotation.']),
       ('03  Confirm your order',['50% deposit, with the balance on delivery.',
       'Your approved specification forms the basis of the order.']),
       ('04  Plan your delivery',['Standard items typically take 10-12 weeks to site.',
       'Allow 12-18 weeks for bespoke items from approved drawings.'])]
for i,(heading,lines) in enumerate(steps):
    y=H-163-i*100;text(40,y,heading,16,'Times-Bold',TEAL)
    for j,line in enumerate(lines):text(40,y-25-j*17,line,10)
text(40,208,'Tell us about your project',22,'Times-Roman')
text(40,178,'IK Eng Ltd',11,'Helvetica-Bold')
text(40,157,'125 Great Clowes Street, Salford, Greater Manchester, M7 1AL',10)
text(40,136,'+44 7767 990007  |  sai@ikeng.co.uk',11)
text(40,111,'https://ikeng.co.uk',11,colour=TEAL)
c.linkURL('https://ikeng.co.uk/#brief',(40,102,300,128),relative=0)
c.save()
print(f'{OUTPUT} ({OUTPUT.stat().st_size:,} bytes)')
