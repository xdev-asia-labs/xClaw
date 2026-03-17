# Nghiên cứu: Admin Quản Trị Dữ Liệu & Trợ Lý Cá Nhân Hóa Cho Bác Sĩ

> **Ngày**: 2026-03-16  
> **Phạm vi**: Xử lý dữ liệu, Fine-tuning, Admin đánh giá dữ liệu, Trợ lý cá nhân hóa bác sĩ

---

## 1. TỔNG QUAN HIỆN TRẠNG

### 1.1 Những gì ĐÃ CÓ

| Thành phần | Trạng thái | Chi tiết |
|---|---|---|
| Memory Manager | In-memory only | `remember()`, `recall()`, `forget()` — mất khi restart |
| Session Manager | In-memory | Timeout 30p, max 5 session/user |
| Chat Interface | Hoạt động | Streaming, conversation list, web search |
| Knowledge Base | Hoạt động | Upload doc, chunk, embed, search (MongoDB) |
| RAG Pipeline | Hoạt động | chunker → embedder → vector search |
| Admin UI | Cơ bản | Users, Channels, Analytics, Models, API Keys, Audit |
| Reports | Cơ bản | Summary, User Activity, Export (MD/Excel/PDF) |
| Healthcare Skill | In-memory | Drug interactions, ICD-10, SOAP notes |

### 1.2 Những gì CHƯA CÓ (Gaps)

| Gap | Mức độ quan trọng |
|---|---|
| **Persistent memory per-user** | 🔴 Critical |
| **Doctor profile & personalization** | 🔴 Critical |
| **Chat history → training data pipeline** | 🔴 Critical |
| **Data quality evaluation UI** | 🟡 High |
| **Fine-tuning dataset management** | 🟡 High |
| **Per-doctor learning dashboard** | 🟡 High |
| **Auto-memory extraction from chat** | 🟠 Medium |
| **A/B testing & model comparison** | 🟠 Medium |
| **Feedback loop (doctor → data quality)** | 🟠 Medium |

---

## 2. KIẾN TRÚC ĐỀ XUẤT

### 2.1 Tổng quan luồng dữ liệu

```
┌─────────────────────────────────────────────────────────┐
│                    DOCTOR (End User)                     │
│  ┌──────────┐  ┌─────────────┐  ┌────────────────────┐ │
│  │ Chat UI  │  │ Preferences │  │ Feedback (👍/👎)   │ │
│  └────┬─────┘  └──────┬──────┘  └─────────┬──────────┘ │
└───────┼───────────────┼────────────────────┼────────────┘
        │               │                    │
        ▼               ▼                    ▼
┌───────────────────────────────────────────────────────────┐
│                  DATA COLLECTION LAYER                     │
│                                                           │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Chat Logger    │  │ Profile Svc  │  │ Feedback Svc │  │
│  │ (every msg)    │  │ (preferences)│  │ (ratings)    │  │
│  └───────┬────────┘  └──────┬───────┘  └──────┬───────┘  │
└──────────┼──────────────────┼──────────────────┼──────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌───────────────────────────────────────────────────────────┐
│                    STORAGE LAYER                           │
│                                                           │
│  PostgreSQL                    MongoDB                     │
│  ┌─────────────────────┐      ┌──────────────────────┐   │
│  │ doctor_profiles     │      │ chat_sessions        │   │
│  │ data_evaluations    │      │ learning_entries     │   │
│  │ finetune_datasets   │      │ doctor_memories      │   │
│  │ finetune_jobs       │      │ finetune_samples     │   │
│  │ feedback_ratings    │      │ knowledge_chunks     │   │
│  │ training_metrics    │      │ embeddings           │   │
│  └─────────────────────┘      └──────────────────────┘   │
└───────────────────────────────────────────────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌───────────────────────────────────────────────────────────┐
│                  PROCESSING LAYER                          │
│                                                           │
│  ┌─────────────────┐  ┌───────────────┐  ┌────────────┐  │
│  │ Auto-Memory     │  │ Data Quality  │  │ Fine-tune  │  │
│  │ Extractor       │  │ Evaluator     │  │ Pipeline   │  │
│  │ (chat→memory)   │  │ (scoring)     │  │ (LoRA)     │  │
│  └─────────────────┘  └───────────────┘  └────────────┘  │
└───────────────────────────────────────────────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌───────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                          │
│                                                           │
│  ┌─────────────┐ ┌───────────┐ ┌──────────┐ ┌─────────┐ │
│  │ Data Review │ │ Doctor    │ │ Training │ │ Quality │ │
│  │ & Evaluate  │ │ Profiles  │ │ Monitor  │ │ Metrics │ │
│  └─────────────┘ └───────────┘ └──────────┘ └─────────┘ │
└───────────────────────────────────────────────────────────┘
```

### 2.2 Component Breakdown

#### A. Doctor Profile System

```
DoctorProfile {
  id: uuid
  user_id: uuid (FK → users)
  specialty: string[]           // "cardiology", "neurology", ...
  experience_years: number
  hospital: string
  preferred_model: string       // model_id they prefer
  preferred_language: "vi" | "en"
  response_style: "concise" | "detailed" | "academic"
  knowledge_bases: string[]     // collection IDs they subscribe to
  custom_instructions: string   // system prompt additions
  auto_learn: boolean           // opt-in for auto memory extraction
  created_at, updated_at
}
```

#### B. Chat Learning System (Core Feature)

Mỗi khi bác sĩ chat, hệ thống sẽ:

1. **Lưu conversation persistent** (đã có schema `conversations` + `chat_messages`)
2. **Auto-extract learning entries** từ chat:
   - Medical preferences (thuốc ưa thích, phác đồ hay dùng)
   - Correction patterns (khi BS sửa lại câu trả lời AI)
   - Domain knowledge (kiến thức chuyên sâu BS chia sẻ)
   - Decision patterns (cách BS ra quyết định)

```
LearningEntry {
  id: ObjectId
  doctor_id: uuid
  source_conversation_id: uuid
  source_message_ids: string[]     // messages that triggered this
  type: "preference" | "correction" | "knowledge" | "decision_pattern"
  category: string                 // "medication", "diagnosis", "procedure"
  content: string                  // extracted insight
  context: string                  // surrounding conversation context
  confidence: number               // 0-1, auto-detection confidence
  status: "auto_detected" | "doctor_confirmed" | "admin_verified" | "rejected"
  embedding: number[]              // for semantic search
  created_at, updated_at
}
```

1. **Doctor có thể review** learning entries của mình
2. **Admin có thể verify** quality của learning data

#### C. Fine-Tuning Dataset Management

```
FinetuneDataset {
  id: uuid
  name: string
  description: string
  doctor_id: uuid | null          // null = global dataset
  source: "chat_history" | "manual" | "imported"
  format: "alpaca" | "sharegpt" | "openai"
  status: "draft" | "reviewing" | "approved" | "training" | "completed"
  sample_count: number
  quality_score: number           // avg quality of samples
  created_by: uuid
  created_at, updated_at
}

FinetuneSample {
  id: ObjectId
  dataset_id: uuid
  source_conversation_id: uuid | null
  instruction: string             // system prompt / instruction
  input: string                   // user message
  output: string                  // expected response
  quality_rating: 1-5             // admin rating
  quality_notes: string           // admin comments
  tags: string[]                  // "medication", "diagnosis", etc.
  status: "pending" | "approved" | "rejected" | "needs_revision"
  reviewed_by: uuid | null
  reviewed_at: Date | null
}

FinetuneJob {
  id: uuid
  dataset_id: uuid
  base_model: string              // e.g., "llama3.2:3b"
  method: "lora" | "qlora" | "full"
  hyperparameters: {
    learning_rate, epochs, batch_size, lora_rank, lora_alpha
  }
  status: "queued" | "preparing" | "training" | "evaluating" | "completed" | "failed"
  progress: number                // 0-100
  metrics: {
    train_loss, eval_loss, accuracy, f1_score
  }
  output_model: string            // resulting model name
  created_at, started_at, completed_at
}
```

---

## 3. ADMIN DASHBOARD DESIGN

### 3.1 Navigation Structure (Thêm vào AdminLayout)

```
OVERVIEW
├── Resources Dashboard      (existing)
├── Health Monitor           (existing)
├── Analytics                (existing)
└── 🆕 Data Quality Overview

OPERATIONS
├── Chat Console             (existing)
├── Knowledge Base           (existing)
├── Workflows                (existing)
├── Skills & Tools           (existing)
├── Models                   (existing)
└── 🆕 Fine-Tuning Studio

DOCTOR MANAGEMENT (🆕 NEW SECTION)
├── 🆕 Doctor Profiles
├── 🆕 Learning Data Review
├── 🆕 Chat Analysis
└── 🆕 Personalization Config

ADMINISTRATION
├── Users                    (existing)
├── Channels                 (existing)
├── API Keys                 (existing)
├── Audit Log                (existing)
└── Settings                 (existing)
```

### 3.2 Màn hình chi tiết

---

#### Màn hình 1: Data Quality Overview

**Mục đích**: Tổng quan chất lượng dữ liệu toàn hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Data Quality Overview                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Learning │  │ Pending  │  │ Quality  │  │ Active   │  │
│  │ Entries  │  │ Review   │  │ Score    │  │ Doctors  │  │
│  │  12,450  │  │   234    │  │  87.3%   │  │    18    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
│  ┌─────────────────────────────┬───────────────────────────┐│
│  │  Learning by Category       │  Quality Trend (30 days)  ││
│  │  ██████████ Medication 45%  │  ┌───────────────────┐   ││
│  │  ████████   Diagnosis  32%  │  │  📈 87% ──────── │   ││
│  │  █████      Procedure  15%  │  │     ╱             │   ││
│  │  ███        Other      8%   │  │    ╱  75%         │   ││
│  │                             │  └───────────────────┘   ││
│  └─────────────────────────────┴───────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Recent Entries Needing Review                          ││
│  │                                                         ││
│  │  ⚪ Dr. Nguyễn - "Prefer metformin over glipizide..."  ││
│  │    Type: preference | Confidence: 0.89 | [Review]       ││
│  │                                                         ││
│  │  ⚪ Dr. Trần - Corrected dosage: "amox 500mg not 1g"  ││
│  │    Type: correction | Confidence: 0.95 | [Review]       ││
│  │                                                         ││
│  │  ⚪ Dr. Lê - Decision pattern: "Always check CrCl..."  ││
│  │    Type: decision_pattern | Confidence: 0.72 | [Review] ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

#### Màn hình 2: Doctor Profiles

**Mục đích**: Quản lý hồ sơ và cá nhân hóa cho từng bác sĩ

```
┌─────────────────────────────────────────────────────────────┐
│  👨‍⚕️ Doctor Profiles                          [+ Add Doctor] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔍 Search doctors...              Filter: [All Specialties]│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Dr. Nguyễn Văn A          Cardiology      🟢 Active    ││
│  │ Memory: 234 entries | Chat: 1,205 msgs | Since: 2025   ││
│  │ Model: GPT-4o | Style: Detailed | Auto-learn: ✅        ││
│  │ [View Profile] [View Learning] [Chat History] [Config]  ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ Dr. Trần Thị B            Neurology       🟢 Active    ││
│  │ Memory: 167 entries | Chat: 892 msgs | Since: 2025     ││
│  │ Model: Llama3.2 | Style: Concise | Auto-learn: ✅       ││
│  │ [View Profile] [View Learning] [Chat History] [Config]  ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ Dr. Lê Hoàng C            Internal Med    🟡 Inactive  ││
│  │ Memory: 45 entries | Chat: 312 msgs | Since: 2026      ││
│  │ Model: Claude | Style: Academic | Auto-learn: ❌         ││
│  │ [View Profile] [View Learning] [Chat History] [Config]  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Doctor Profile Detail**:

```
┌─────────────────────────────────────────────────────────────┐
│  👨‍⚕️ Dr. Nguyễn Văn A                           [Edit] [Save]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tabs: [Profile] [Learning Data] [Chat History] [Config]    │
│                                                             │
│  ┌─ Profile ───────────────────────────────────────────────┐│
│  │ Specialty:     [Cardiology]  [Internal Medicine]        ││
│  │ Hospital:      [Bệnh viện Đại học Y Dược]              ││
│  │ Experience:    [15] years                               ││
│  │ Preferred Model: [GPT-4o ▼]                             ││
│  │ Response Style:  [Detailed ▼]                           ││
│  │ Language:        [Vietnamese ▼]                          ││
│  │ Auto-Learn:      [✅ Enabled]                            ││
│  │                                                         ││
│  │ Custom Instructions:                                    ││
│  │ ┌─────────────────────────────────────────────────────┐ ││
│  │ │ Luôn include EBM references khi đưa ra khuyến cáo. │ ││
│  │ │ Ưu tiên guideline ESC 2024 cho bệnh tim mạch.      │ ││
│  │ │ Dùng thuật ngữ tiếng Việt kèm tiếng Anh trong ().  │ ││
│  │ └─────────────────────────────────────────────────────┘ ││
│  │                                                         ││
│  │ Knowledge Bases:                                        ││
│  │ ☑ ICD-10 Drug Interactions                              ││
│  │ ☑ VN Drug Formulary                                     ││
│  │ ☑ ESC Guidelines 2024                                   ││
│  │ ☐ WHO Essential Medicines                               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

#### Màn hình 3: Learning Data Review

**Mục đích**: Admin review và đánh giá dữ liệu tự học từ chat

```
┌─────────────────────────────────────────────────────────────┐
│  📚 Learning Data Review                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Filter: [All Doctors ▼] [All Types ▼] [Pending Review ▼]  │
│  Sort:   [Newest First ▼]                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🟡 PENDING | Dr. Nguyễn | preference | Confidence: 89% ││
│  │                                                         ││
│  │ 📝 Content:                                             ││
│  │ "Bác sĩ ưu tiên dùng Metformin XR 750mg cho BN ĐTĐ    ││
│  │  type 2 mới chẩn đoán, chỉ dùng Glipizide khi eGFR    ││
│  │  > 45 và HbA1c > 8.5%"                                 ││
│  │                                                         ││
│  │ 💬 Source Chat Context:                                  ││
│  │ ┌────────────────────────────────────────────────────┐  ││
│  │ │ 🤖 AI: Suggest Glipizide 5mg cho BN này...        │  ││
│  │ │ 👨‍⚕️ BS: Không, tôi luôn dùng Metformin XR 750mg   │  ││
│  │ │       trước. Chỉ add Glipizide khi HbA1c > 8.5%   │  ││
│  │ │ 🤖 AI: Đã ghi nhận. Metformin XR 750mg là lựa     │  ││
│  │ │       chọn đầu tiên cho BN ĐTĐ type 2 mới...      │  ││
│  │ └────────────────────────────────────────────────────┘  ││
│  │                                                         ││
│  │ [✅ Approve] [✏️ Edit & Approve] [❌ Reject] [🔄 Skip]  ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ 🟡 PENDING | Dr. Trần | correction | Confidence: 95%   ││
│  │                                                         ││
│  │ 📝 Content:                                             ││
│  │ "Liều Amoxicillin cho viêm phổi cộng đồng người lớn   ││
│  │  là 500mg x 3 lần/ngày, KHÔNG phải 1g x 2 lần/ngày"   ││
│  │                                                         ││
│  │ 💬 [Expand Source Chat]                                  ││
│  │                                                         ││
│  │ [✅ Approve] [✏️ Edit & Approve] [❌ Reject] [🔄 Skip]  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  📊 Review Stats: 234 pending | 12,216 approved | 89 rej.  │
└─────────────────────────────────────────────────────────────┘
```

---

#### Màn hình 4: Chat Analysis (Per-Doctor)

**Mục đích**: Bác sĩ và Admin xem được phần tự học qua chat

```
┌─────────────────────────────────────────────────────────────┐
│  💬 Chat Analysis — Dr. Nguyễn Văn A                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tabs: [Timeline] [Topics] [Learning Map] [Quality]         │
│                                                             │
│  ═══ Timeline View ═══                                      │
│                                                             │
│  📅 Today (3 conversations)                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🕐 14:30 | "Tư vấn phác đồ điều trị tăng huyết áp"    ││
│  │    Messages: 12 | Tokens: 3,450 | 🧠 2 learnings       ││
│  │    Feedback: 👍 | Topics: hypertension, ACEi, ARB       ││
│  │    [View Chat] [View Learnings]                         ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ 🕐 10:15 | "Check tương tác thuốc Warfarin + ASA"      ││
│  │    Messages: 6 | Tokens: 1,200 | 🧠 0 learnings        ││
│  │    Feedback: 👍 | Topics: drug-interaction, anticoag    ││
│  │    [View Chat] [View Learnings]                         ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ 🕐 08:45 | "Đánh giá kết quả XN BN Trần Văn D"        ││
│  │    Messages: 8 | Tokens: 2,100 | 🧠 1 learning         ││
│  │    Feedback: ✏️ Corrected | Topics: lab-interpret       ││
│  │    ⚠️ Correction: "BNP > 400 cần echo ngay, ko đợi"   ││
│  │    [View Chat] [View Learnings]                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ═══ Learning Map ═══ (accumulated knowledge)               │
│                                                             │
│  ┌─ Medication Preferences (89 entries) ───────────────┐   │
│  │ • Metformin XR 750mg → first line T2DM              │   │
│  │ • Atorvastatin > Rosuvastatin for ACS               │   │
│  │ • Avoid NSAIDs in CKD stage 3+                      │   │
│  │ • Prefer Bisoprolol over Atenolol for HF            │   │
│  │ [View All 89 →]                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Diagnostic Patterns (67 entries) ──────────────────┐   │
│  │ • Always check CrCl before prescribing Metformin    │   │
│  │ • Troponin serial Q6h for ACS rule-out              │   │
│  │ • BNP > 400 → urgent echo                          │   │
│  │ [View All 67 →]                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Quality Metrics ───────────────────────────────────┐   │
│  │ Response Accuracy: 94.2% (based on corrections)     │   │
│  │ Correction Rate:   5.8% (trending ↓ good)           │   │
│  │ Avg Satisfaction:  4.6/5 (from feedback)             │   │
│  │ Top Corrections:  Dosage (42%), Interaction (31%)   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

#### Màn hình 5: Fine-Tuning Studio

**Mục đích**: Quản lý dataset và fine-tune model từ dữ liệu đã review

```
┌─────────────────────────────────────────────────────────────┐
│  🔧 Fine-Tuning Studio                    [+ New Dataset]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tabs: [Datasets] [Training Jobs] [Evaluation]              │
│                                                             │
│  ═══ Datasets ═══                                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 📦 VN-Cardiology-v2                    Status: Approved ││
│  │ Doctor: Dr. Nguyễn | Samples: 1,234 | Quality: 4.3/5   ││
│  │ Source: Chat History (auto-extracted)                    ││
│  │ Format: ShareGPT | Created: 2026-03-10                  ││
│  │ [Review Samples] [Start Training] [Export] [Delete]     ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ 📦 General-Healthcare-v1               Status: Reviewing││
│  │ Doctor: Global | Samples: 5,678 | Quality: 4.1/5       ││
│  │ Source: Mixed (chat + manual)                           ││
│  │ Pending Review: 234 samples                             ││
│  │ [Review Samples] [Export] [Delete]                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ═══ Sample Review (for selected dataset) ═══              │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Sample #1234                        Quality: ⭐⭐⭐⭐☆  ││
│  │                                                         ││
│  │ 📋 Instruction:                                         ││
│  │ "Bạn là trợ lý y khoa chuyên khoa tim mạch."           ││
│  │                                                         ││
│  │ 👤 Input:                                               ││
│  │ "BN nam 65t, THA, ĐTĐ type 2, CKD stage 3.            ││
│  │  HA hiện tại 150/95. Đang dùng Amlodipine 5mg.         ││
│  │  Nên adjust phác đồ thế nào?"                           ││
│  │                                                         ││
│  │ 🤖 Expected Output:                                     ││
│  │ "Với BN có THA + ĐTĐ + CKD stage 3, ưu tiên:          ││
│  │  1. Thêm ACEi/ARB (Perindopril 5mg hoặc Losartan 50mg)││
│  │     → bảo vệ thận, giảm protein niệu                   ││
│  │  2. Tăng Amlodipine 10mg nếu chưa đạt target           ││
│  │  3. Target HA < 130/80 (theo ESC/ESH 2023)             ││
│  │  ⚠️ Theo dõi K+ và Creatinine sau 1-2 tuần add ACEi"  ││
│  │                                                         ││
│  │ Tags: [hypertension] [diabetes] [ckd] [medication]      ││
│  │                                                         ││
│  │ [✅ Approve] [✏️ Edit] [❌ Reject] [⭐ Rate Quality]    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ═══ Training Jobs ═══                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🏋️ Job: cardio-lora-v2          Status: Training (67%) ││
│  │ Base: llama3.2:8b | Method: QLoRA | Dataset: VN-Card-v2││
│  │ Epochs: 3/5 | Loss: 0.342 | LR: 2e-4                  ││
│  │ ┌───────────────────────────────────────┐               ││
│  │ │ Loss Curve  📉                       │               ││
│  │ │ 1.2 ─╲                               │               ││
│  │ │       ╲─╲                             │               ││
│  │ │          ╲──── 0.34                   │               ││
│  │ └───────────────────────────────────────┘               ││
│  │ [View Details] [Stop] [Download Model]                  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 4. LUỒNG XỬ LÝ DỮ LIỆU CHI TIẾT

### 4.1 Auto-Learning Pipeline (Chat → Learning Entry)

```
Doctor chats
    │
    ▼
┌───────────────────────────┐
│ 1. Message stored in DB   │  (chat_messages table)
│    with full context      │
└────────────┬──────────────┘
             │
             ▼
┌───────────────────────────┐
│ 2. Auto-Memory Extractor  │  (background job, runs per-message)
│    Detects:               │
│    - Corrections (BS sửa) │  → pattern: user corrects AI response
│    - Preferences (BS chọn)│  → pattern: user states preference
│    - Knowledge sharing    │  → pattern: user teaches new info
│    - Decision patterns    │  → pattern: user explains reasoning
└────────────┬──────────────┘
             │
             ▼
┌───────────────────────────┐
│ 3. LLM Classification    │  (small, fast model)
│    Input: conversation    │
│    Output: {              │
│      type, content,       │
│      confidence, category │
│    }                      │
└────────────┬──────────────┘
             │
             ▼
┌───────────────────────────┐
│ 4. Embedding Generation   │  (nomic-embed-text)
│    For semantic search    │
└────────────┬──────────────┘
             │
             ▼
┌───────────────────────────┐
│ 5. Store as LearningEntry │
│    status: auto_detected  │
│    → Available for review │
└───────────────────────────┘
```

### 4.2 Chat → Fine-Tuning Dataset Pipeline

```
Approved LearningEntries
    │
    ▼
┌───────────────────────────┐
│ 1. Dataset Builder        │
│    Select entries by:     │
│    - Doctor / All         │
│    - Category             │
│    - Quality threshold    │
│    - Date range           │
└────────────┬──────────────┘
             │
             ▼
┌───────────────────────────┐
│ 2. Sample Generator       │
│    Transform chat → pairs │
│    (instruction, input,   │
│     output) format        │
│    Add system context     │
└────────────┬──────────────┘
             │
             ▼
┌───────────────────────────┐
│ 3. Quality Filter         │
│    - Remove duplicates    │
│    - Check consistency    │
│    - Validate medical     │
│      accuracy (optional)  │
└────────────┬──────────────┘
             │
             ▼
┌───────────────────────────┐
│ 4. Admin Review UI        │  ← Màn hình 5 ở trên
│    Rate & approve samples │
└────────────┬──────────────┘
             │
             ▼
┌───────────────────────────┐
│ 5. Export & Fine-tune     │
│    → Alpaca/ShareGPT JSON │
│    → Submit to Ollama or  │
│      Unsloth/Axolotl      │
└───────────────────────────┘
```

### 4.3 Doctor View: Self-Learning Dashboard

```
Doctor logs in (UserLayout)
    │
    ▼
┌───────────────────────────┐
│ New sidebar items:        │
│ • My Learning             │
│ • Chat History            │
│ • My Preferences          │
└────────────┬──────────────┘
             │
             ▼
┌───────────────────────────────────────────────┐
│ My Learning Dashboard                          │
│                                                │
│ ┌─ What I've taught the AI ──────────────────┐│
│ │ Total learnings: 234                       ││
│ │ ✅ Confirmed: 189 | ⏳ Pending: 35 | ❌ 10 ││
│ │                                            ││
│ │ Recent:                                    ││
│ │ • "Prefer Bisoprolol for HFrEF"    [✅/❌]││
│ │ • "Always check K+ with ACEi"      [✅/❌]││
│ │ • "BNP > 400 → urgent echo"       [✅/❌]││
│ │                                            ││
│ │ [View All] [Export My Knowledge]           ││
│ └────────────────────────────────────────────┘│
│                                                │
│ ┌─ AI Accuracy for me ──────────────────────┐│
│ │ Accuracy: 94.2% | Corrections: 14 (Mar)   ││
│ │ Trending: ↑ improving (was 89% in Jan)     ││
│ │                                            ││
│ │ Areas where AI still makes mistakes:       ││
│ │ • Drug dosing in CKD (3 corrections)       ││
│ │ • Interaction with herbal medicines (2)     ││
│ └────────────────────────────────────────────┘│
└───────────────────────────────────────────────┘
```

---

## 5. DATABASE SCHEMA BỔ SUNG

### 5.1 PostgreSQL (Thêm tables)

```sql
-- Doctor profiles (linked to existing users table)
CREATE TABLE doctor_profiles (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id UUID NOT NULL REFERENCES users(id),
  specialty TEXT[] NOT NULL DEFAULT '{}',
  experience_years INTEGER,
  hospital TEXT,
  preferred_model_id UUID REFERENCES model_profiles(id),
  preferred_language VARCHAR(5) DEFAULT 'vi',
  response_style VARCHAR(20) DEFAULT 'detailed'
    CHECK (response_style IN ('concise', 'detailed', 'academic')),
  custom_instructions TEXT DEFAULT '',
  auto_learn BOOLEAN DEFAULT true,
  knowledge_base_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Fine-tuning datasets metadata
CREATE TABLE finetune_datasets (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  doctor_id UUID REFERENCES doctor_profiles(id),  -- null = global
  source VARCHAR(20) NOT NULL CHECK (source IN ('chat_history', 'manual', 'imported')),
  format VARCHAR(20) NOT NULL DEFAULT 'sharegpt'
    CHECK (format IN ('alpaca', 'sharegpt', 'openai')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewing', 'approved', 'training', 'completed')),
  sample_count INTEGER DEFAULT 0,
  quality_score NUMERIC(3,2) DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fine-tuning jobs tracking
CREATE TABLE finetune_jobs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  dataset_id UUID NOT NULL REFERENCES finetune_datasets(id),
  base_model VARCHAR(255) NOT NULL,
  method VARCHAR(20) NOT NULL DEFAULT 'qlora'
    CHECK (method IN ('lora', 'qlora', 'full')),
  hyperparameters JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','preparing','training','evaluating','completed','failed')),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  metrics JSONB DEFAULT '{}',
  output_model VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Data quality evaluations
CREATE TABLE data_evaluations (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  entry_type VARCHAR(30) NOT NULL, -- 'learning_entry' or 'finetune_sample'
  entry_id VARCHAR(255) NOT NULL,  -- ObjectId reference
  reviewer_id UUID NOT NULL REFERENCES users(id),
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('approved', 'rejected', 'needs_revision')),
  notes TEXT,
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback ratings on individual messages
CREATE TABLE message_feedback (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  conversation_id UUID NOT NULL,
  message_id UUID NOT NULL,
  doctor_id UUID NOT NULL REFERENCES doctor_profiles(id),
  rating VARCHAR(10) NOT NULL CHECK (rating IN ('positive', 'negative', 'correction')),
  correction_text TEXT,  -- when doctor corrects AI
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_doctor_profiles_user ON doctor_profiles(user_id);
CREATE INDEX idx_finetune_datasets_doctor ON finetune_datasets(doctor_id);
CREATE INDEX idx_finetune_datasets_status ON finetune_datasets(status);
CREATE INDEX idx_finetune_jobs_dataset ON finetune_jobs(dataset_id);
CREATE INDEX idx_finetune_jobs_status ON finetune_jobs(status);
CREATE INDEX idx_data_evaluations_entry ON data_evaluations(entry_type, entry_id);
CREATE INDEX idx_message_feedback_doctor ON message_feedback(doctor_id, created_at DESC);
CREATE INDEX idx_message_feedback_conversation ON message_feedback(conversation_id);
```

### 5.2 MongoDB (Thêm collections)

```javascript
// learning_entries - Auto-extracted knowledge from chat
{
  _id: ObjectId,
  doctor_id: "uuid",
  source_conversation_id: "uuid",
  source_message_ids: ["uuid", "uuid"],
  type: "preference" | "correction" | "knowledge" | "decision_pattern",
  category: "medication" | "diagnosis" | "procedure" | "lab_interpretation" | "other",
  content: "Extracted learning content...",
  context: "Surrounding conversation for reference...",
  confidence: 0.89,  // auto-detection confidence
  status: "auto_detected" | "doctor_confirmed" | "admin_verified" | "rejected",
  embedding: [0.1, 0.2, ...],  // 768-dim vector
  tags: ["hypertension", "acei"],
  created_at: ISODate,
  updated_at: ISODate
}

// finetune_samples - Individual training examples
{
  _id: ObjectId,
  dataset_id: "uuid",
  source_conversation_id: "uuid",
  instruction: "System prompt...",
  input: "User message...",
  output: "Expected AI response...",
  quality_rating: 4,
  quality_notes: "Good example of...",
  tags: ["cardiology", "medication"],
  status: "pending" | "approved" | "rejected" | "needs_revision",
  reviewed_by: "uuid",
  reviewed_at: ISODate,
  created_at: ISODate
}

// doctor_memories - Persistent per-doctor memory
{
  _id: ObjectId,
  doctor_id: "uuid",
  key: "medication_preference_diabetes",
  content: "Prefer Metformin XR 750mg first-line for T2DM",
  category: "medication",
  source: "auto" | "manual",
  source_learning_id: ObjectId,  // reference to learning_entry
  embedding: [0.1, 0.2, ...],
  access_count: 15,  // how often this memory is recalled
  last_accessed: ISODate,
  created_at: ISODate,
  updated_at: ISODate
}

// Indexes
db.learning_entries.createIndex({ doctor_id: 1, status: 1, created_at: -1 });
db.learning_entries.createIndex({ type: 1, category: 1 });
db.learning_entries.createIndex({ embedding: "vectorSearch" });  // Atlas Vector Search

db.finetune_samples.createIndex({ dataset_id: 1, status: 1 });
db.finetune_samples.createIndex({ tags: 1 });

db.doctor_memories.createIndex({ doctor_id: 1, category: 1 });
db.doctor_memories.createIndex({ doctor_id: 1, key: 1 }, { unique: true });
db.doctor_memories.createIndex({ embedding: "vectorSearch" });
```

---

## 6. API ENDPOINTS BỔ SUNG

### 6.1 Doctor Profile APIs

```
GET    /api/doctors                        -- List doctor profiles
POST   /api/doctors                        -- Create profile
GET    /api/doctors/:id                    -- Get profile
PUT    /api/doctors/:id                    -- Update profile
GET    /api/doctors/:id/stats              -- Learning stats
GET    /api/doctors/me                     -- Current doctor's profile
PUT    /api/doctors/me/preferences         -- Update own preferences
```

### 6.2 Learning Data APIs

```
GET    /api/learning                       -- List entries (admin: all, doctor: own)
GET    /api/learning/:id                   -- Get entry with source chat
PATCH  /api/learning/:id/status            -- Approve/reject (admin)
PATCH  /api/learning/:id/confirm           -- Doctor confirms own entry
GET    /api/learning/stats                 -- Aggregated stats
GET    /api/learning/doctor/:id            -- All entries for a doctor
POST   /api/learning/extract               -- Manually trigger extraction
```

### 6.3 Fine-Tuning APIs

```
GET    /api/finetune/datasets              -- List datasets
POST   /api/finetune/datasets              -- Create dataset
GET    /api/finetune/datasets/:id          -- Get dataset
PUT    /api/finetune/datasets/:id          -- Update dataset
DELETE /api/finetune/datasets/:id          -- Delete dataset

GET    /api/finetune/datasets/:id/samples  -- List samples (paginated)
POST   /api/finetune/datasets/:id/samples  -- Add sample
PATCH  /api/finetune/samples/:id           -- Update sample (review)
POST   /api/finetune/datasets/:id/generate -- Auto-generate from learning data

POST   /api/finetune/jobs                  -- Start training job
GET    /api/finetune/jobs                  -- List jobs
GET    /api/finetune/jobs/:id              -- Job status & metrics
DELETE /api/finetune/jobs/:id              -- Cancel job
GET    /api/finetune/jobs/:id/logs         -- Training logs (stream)
```

### 6.4 Feedback APIs

```
POST   /api/messages/:id/feedback          -- Rate a message (👍/👎/correction)
GET    /api/feedback/stats                 -- Feedback analytics
GET    /api/feedback/doctor/:id            -- Doctor's feedback history
```

### 6.5 Chat Analysis APIs

```
GET    /api/chat-analysis/doctor/:id       -- Doctor's chat analysis
GET    /api/chat-analysis/doctor/:id/topics -- Topic breakdown
GET    /api/chat-analysis/doctor/:id/quality -- Quality metrics
GET    /api/chat-analysis/doctor/:id/timeline -- Chat timeline
```

---

## 7. IMPLEMENTATION PRIORITY

### Phase 1: Foundation (2-3 tuần)

1. **Doctor Profile System** — DB schema + CRUD API + UI
2. **Persistent Memory** — Upgrade MemoryManager to use MongoDB
3. **Message Feedback** — Add 👍/👎/correction to ChatPanel
4. **Chat History Persistence** — Ensure all messages stored properly

### Phase 2: Learning Engine (3-4 tuần)

5. **Auto-Memory Extractor** — Background job that analyzes chat
2. **Learning Entry Storage** — MongoDB collection + API
3. **Learning Data Review UI** — Admin review dashboard
4. **Doctor Self-Learning View** — Doctor sees own learning data

### Phase 3: Fine-Tuning (3-4 tuần)

9. **Dataset Builder** — Auto-generate from approved learning entries
2. **Sample Review UI** — Admin rates and approves samples
3. **Fine-Tune Job Runner** — Integration with Unsloth/Axolotl
4. **Training Monitor** — Real-time loss curves and metrics

### Phase 4: Intelligence (2-3 tuần)

13. **Quality Analytics Dashboard** — Data quality overview
2. **Chat Analysis** — Per-doctor topic and quality analysis
3. **A/B Testing** — Compare base vs fine-tuned model
4. **Personalized RAG** — Per-doctor knowledge base priority

---

## 8. TECH STACK BỔ SUNG

| Component | Technology | Lý do |
|---|---|---|
| Auto-Memory Extraction | Small LLM (Llama 3.2 3B) | Fast classification, low cost |
| Fine-Tuning | Unsloth + QLoRA | Memory efficient, fast on consumer GPU |
| Training Monitor | WebSocket events | Real-time progress updates |
| Vector Search | MongoDB Atlas Vector Search | Already in stack |
| Background Jobs | Bull/BullMQ + Redis | Job queue for extraction & training |
| Charts | Recharts (already used) | Consistent with existing Analytics |
| Export | XLSX + PDF (already used) | Consistent with existing Reports |

---

## 9. SECURITY CONSIDERATIONS

- **PHI Protection**: Tất cả medical data phải encrypt at rest
- **Per-Doctor Isolation**: Strict user_id filtering trên mọi query
- **Admin Audit**: Mọi action review phải log trong audit_log
- **Consent**: Doctor phải opt-in auto-learn (default: true, nhưng có thể tắt)
- **Data Retention**: Learning entries có TTL policy, archival sau 2 năm
- **Export Control**: Fine-tune datasets chỉ admin mới export được
- **RBAC**: Doctor chỉ xem data của mình, Admin xem tất cả
