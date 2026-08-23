# W02 — Queue/Redis/Cache Isolation Blocker

الحالة: **LOCAL CODE/DESIGN BLOCKER — قابل للحل داخل repository، لكنه غير مغلق.** يثبت الجرد أن queue names عامة (`sms`, `email`, `notification`, `communications-publication`) وأن payloads لا تحمل `organizationId` موثوقاً أو lease/context fingerprint. كما يسمح `InMemoryQueue` عند غياب `REDIS_URL` بإرجاع success بلا worker isolation، وworker notification يستورد global Prisma.

لا يمكن اعتبار هذه surfaces tenant-isolated أو استخدام client-supplied org في payload كحل. يلزم contract جديد: context صادر server-side، namespace/key tenant-bound، worker validation against trusted context، repository tenant-bound لكل DB write، replay/retry/DLQ/stale/restart/concurrency evidence، وحظر InMemory success على job tenant-sensitive. لا يبدأ Redis runtime proof قبل هذا cutover.
