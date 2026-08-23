# W02 — Root Documents / Upload Inventory

`/api/upload` يختار object path من `session.user.id` ويستدعي storage العام، ولا يثبت `TenantContext` أو ownership document أو namespace مستأجرياً. documents تظهر ضمن BeneficiaryRepository للقراءة المقيدة، لكن upload/download/delete لا يملك بعد data-plane contract متصل بها. لذلك Root Documents API لا يمكن اعتباره مكتملًا ولا يدخل في RLS closure قبل حل Storage isolation وبناء document ownership/authorization مستقل.
