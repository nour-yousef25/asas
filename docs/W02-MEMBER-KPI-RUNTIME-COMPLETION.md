# W02 — Member/KPI Runtime Completion

## نطاق الإثبات

أثبت harness مستقل على PostgreSQL disposable العقد `MK01–MK10` لمسارات Member/KPI المنقولة. يستخدم التنفيذ lease أحادية الاستخدام من `TenantAccessBroker` وموفر اتصال يتحقق من `session_user` للـtenant LOGIN principal. لا ينشئ الدليل RLS مالية ولا يعتمد على GUC أو credential عالمي أو owner أو superuser أو `BYPASSRLS`.

| البوابة | النتيجة |
|---|---|
| تغطية IDs الدقيقة | `MK01–MK10` كاملة، بلا IDs مفقودة أو مكررة أو غير صالحة |
| العزل A/B وIDOR | PASS للقوائم والتفاصيل وMember renewal وKPI/KPIRecord parent-child |
| nullable-root | PASS؛ الصفوف ذات ownership التاريخي NULL لا تظهر في tenant list |
| lifecycle | PASS للـreplay وrevocation وstale session وstale policy والـrotation وprovider outage والـparallel discard |
| hygiene/cleanup | PASS؛ لا databases أو roles باقية، ولا credentials أو data إنتاجية |

## حدود النتيجة

هذه **COMPLETE LIMITED AUDIT RUNTIME** لمسار Member/KPI فقط. لا تثبت تشغيل provider الإنتاجي أو DR/HA/scale، ولا تغلق Users/Memberships أو Queue/Storage/Documents أو Financial RLS. يلزم regression ثم controlled integration إلى canonical W02، ولا يغير ذلك أولوية عائق provider التشغيلي.
