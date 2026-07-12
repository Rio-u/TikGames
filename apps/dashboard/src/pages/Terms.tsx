import { LegalPage } from "../components/LegalPage";

export default function Terms() {
  return (
    <LegalPage title="الشروط والأحكام">
      <p>
        آخر تحديث: {new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
      </p>
      <p>
        <strong>الصفحة دي لسه مسودة أولية.</strong> باستخدامك TikGames في مرحلة التجربة الحالية،
        إنت موافق إن المنصة لسه تحت التطوير، وبعض الميزات (زي الألعاب نفسها والاتصال بـ TikTok
        Live) لسه بتتبنى.
      </p>
      <p>
        التجربة المجانية 3 أيام من غير أي التزام دفع. تفعيل أي اشتراك مدفوع بيتم يدوياً من الفريق
        حالياً، لحد ما بوابة دفع رسمية تتضاف.
      </p>
      <p>
        TikGames منصة مستقلة وغير تابعة رسمياً لـ TikTok. الاتصال باللايف بيعتمد على بروتوكولات
        غير رسمية، وممكن ينقطع لو TikTok غيّر حاجة من جهته — إحنا بنعمل قصارى جهدنا نبلغك فوراً لو
        ده حصل.
      </p>
    </LegalPage>
  );
}
