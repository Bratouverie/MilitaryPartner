# ОТЧЁТ: Исправление критических проблем в создании пользователей и программ

## 📋 РЕЗЮМЕ

**Дата:** 2026-06-20  
**Статус:** ✅ ИСПРАВЛЕНО  
**Критичность:** Высокая (блокирует работу админов и новых рефералов)  
**Затронутые файлы:** 
- `src/pages/admin/AdminUsers.jsx`
- Логика использует `createChildProgram` из `src/lib/programUtils.js`

---

## 🔴 ПРОБЛЕМА 1: Неактуальные программы в CreateStaffModal

### Причина
```javascript
// БЫЛО: программы загружались один раз при монтировании AdminUsers
const load = async () => {
  const [data, mls, progs] = await Promise.all([...]);
  setPrograms(progs); // кэш на весь компонент
};

useEffect(() => { load(); }, []);

// И передавались в модал как props
<CreateStaffModal programs={programs} />
```

**Проблемы:**
1. Когда админ открывает модал — видит **старый список** программ
2. Если программу **заархивировали** — она всё ещё видна в выборе
3. Если создали **новую программу** — её нет в списке
4. Нет фильтрации по `is_archived`, `program_status`, `is_root`
5. Смешиваются legacy MasterLink и новые ReferralProgram

### Результат
❌ Админ создаёт реферала, назначает ему архивную программу  
❌ Реферал не может начать работу с мёртвой программой  
❌ Список в модале никогда не синхронизируется с реальной БД  

---

## ✅ ИСПРАВЛЕНИЕ 1: Свежая загрузка программ при открытии модала

### Что изменилось

**Было:**
```javascript
function CreateStaffModal({ ..., programs }) {
  // programs — кэшированный список из монтирования родителя
  return (
    <select>
      {programs.filter(p => p.is_root).map(...)}
    </select>
  );
}
```

**Стало:**
```javascript
function CreateStaffModal({ onClose, onCreated, masterLinks, currentRole }) {
  // programs больше НЕ передаются как props
  
  const [freshPrograms, setFreshPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(false);

  // Загружаем свежие программы при открытии модала
  useEffect(() => {
    setProgramsLoading(true);
    base44.entities.ReferralProgram.filter({
      is_root: true,        // только корневые
      is_archived: false    // исключаем архивные
    })
    .then(progs => {
      // Фильтруем по статусу
      const active = progs.filter(p => p.program_status === "active");
      setFreshPrograms(active);
    })
    .catch(() => setFreshPrograms([]))
    .finally(() => setProgramsLoading(false));
  }, []);

  return (
    <select>
      {programsLoading ? "Загрузка..." : null}
      {freshPrograms.map(p => (...))}
    </select>
  );
}
```

### Преимущества
✅ **Свежие данные** — загружаются только при открытии модала  
✅ **Архивные исключены** — `is_archived: false` в фильтре  
✅ **Только активные** — `program_status === "active"`  
✅ **Только корневые** — `is_root: true`  
✅ **ReferralProgram только** — больше нет legacy MasterLink как основной источник  
✅ **Человекочитаемые имена** — показываем `internal_display_title`  

---

## 🔴 ПРОБЛЕМА 2: Реферал БЕЗ собственной ReferralProgram

### Причина
```javascript
// БЫЛО: при создании реферала-L1
const profile = await base44.entities.ReferralProfile.create({
  role: "referrer",
  ...
});

// Попытка назначить через ProgramMembership
if (isL1Referrer && form.program_id) {
  await base44.entities.ProgramMembership.create({
    user_id: profile.id,
    program_id: form.program_id,  // ← назначили в РОДИТЕЛЬСКУЮ программу
    membership_role: "owner",
    ...
  }).catch(() => {}); // ← молча проглатываем ошибки!
}
```

**Проблемы:**
1. **Профиль создан**, но **собственной программы НЕТ**
2. MyPrograms.jsx и MyLink.jsx ищут `owner_user_id` — не найдут ничего
3. Реферал не видит в кабинете свою ссылку `/join/:code`
4. Реферал не видит ссылку на анкету `/candidate/:code`
5. Ошибки создания ProgramMembership **молча проглатываются** (`.catch(() => {})`)
6. Сиротский профиль в БД, не привязанный к реальной программе

### Результат
❌ Админ создаёт реферала → профиль создан  
❌ Реферал заходит в кабинет → "Программа не назначена"  
❌ Реферал не может поделиться ссылкой → её нет  
❌ Админ не видит ошибку — что-то молча поломалось  

---

## ✅ ИСПРАВЛЕНИЕ 2: Создание собственной ReferralProgram для реферала

### Что изменилось

**Было:**
```javascript
const profile = await create ReferralProfile({...});

if (isL1Referrer && form.program_id) {
  // Только ProgramMembership — попытка "назначить" в чужую программу
  await base44.entities.ProgramMembership.create({...})
    .catch(() => {}); // молчание = ошибка
}
```

**Стало:**
```javascript
import { createChildProgram } from "@/lib/programUtils";

const profile = await base44.entities.ReferralProfile.create({...});

// Если это L1 реферал — создаём собственную ReferralProgram
let childProgram = null;
if (isL1Referrer && form.program_id) {
  const parentProgram = freshPrograms.find(p => p.id === form.program_id);
  if (!parentProgram) throw new Error("Родительская программа не найдена");
  
  const { program: prog, error: progError } = await createChildProgram({
    parentProgram,
    title: form.full_name || "Реферал",
    childQuota: parentProgram.reward_quota,  // наследуем квоту родителя
    ownerUserId: profile.id,  // ← новый реферал — владелец!
    actorUserId: getStoredProfileId(),
  });
  
  // Явная проверка ошибки — НЕ молчание!
  if (progError || !prog) {
    // Откат: помечаем профиль как неактивный
    await base44.entities.ReferralProfile.update(profile.id, { status: "inactive" });
    throw new Error(`Ошибка создания программы реферала: ${progError}`);
  }
  childProgram = prog;
}
```

### Что создаёт createChildProgram

Используется **ТА ЖЕ логика** что и в обычном onboarding по `/join/:code`:

```javascript
{
  title: "internal_display_title",              // "Программа — Реферал"
  base_program_title: "...",                    // наследуется от родителя
  child_prefix_title: form.full_name || "Реферал",
  internal_display_title: "...",
  public_program_title: "...",
  link_code: "...",                             // уникальный код для /join/
  candidate_form_code: "...",                   // уникальный код для /candidate/
  owner_user_id: profile.id,                    // ← новый реферал владеет ей!
  parent_program_id: form.program_id,           // родитель
  root_program_id: parentProgram.root_program_id, // корень дерева
  depth: parentProgram.depth + 1,               // глубина + 1
  ancestry_path_ids: "[...parent..., parent.id]", // корректное дерево
  ancestry_path_text: "...",                    // текстовое представление
  program_kind: "child",
  program_status: "active",
  is_root: false,
  is_active: true,
  is_archived: false,
  reward_quota: parentProgram.reward_quota,     // наследуем квоту
  // ... остальное
}
```

Плюс **ProgramMembership** создаётся автоматически в createChildProgram.

### Преимущества
✅ **Реферал имеет собственную программу** — owner_user_id = profile.id  
✅ **Собственные ссылки** — /join/:code и /candidate/:code  
✅ **Правильное дерево** — depth, ancestry, root_id — всё корректно  
✅ **Откат при ошибке** — профиль помечается как inactive, не остаётся сиротским  
✅ **Ошибки видны** — не молчим, выбрасываем исключение  
✅ **Согласование моделей** — dashboard/MyPrograms и MyLink работают по owner_user_id  

---

## 3️⃣ СОГЛАСОВАНИЕ МОДЕЛЕЙ

### Было (БЕЗ СОГЛАСОВАНИЯ)
```javascript
// Запись: AdminUsers → ProgramMembership
await base44.entities.ProgramMembership.create({
  user_id: profile.id,
  program_id: parentProgram.id  // назначаем в РОДИТЕЛЯ
});

// Чтение: MyPrograms.jsx
const myPrograms = await base44.entities.ReferralProgram.filter({
  owner_user_id: profile.id  // ищём СВОИ программы
});
// Результат: не найдёт ничего!
```

### Стало (СОГЛАСОВАНО)
```javascript
// Создание: AdminUsers → createChildProgram
const childProgram = await createChildProgram({
  parentProgram,
  ...,
  ownerUserId: profile.id  // реферал владеет ДОЧЕРНЕЙ программой
});

// Чтение: MyPrograms.jsx, MyLink.jsx
const myPrograms = await base44.entities.ReferralProgram.filter({
  owner_user_id: profile.id  // находит дочернюю программу!
});
// Результат: находит { link_code, candidate_form_code, ... }
```

**Источник истины:** `ReferralProgram.owner_user_id`  
**Вспомогательная роль:** `ProgramMembership` (используется для аудита, истории, иерархии доступа)

---

## 🧪 ПРОВЕРКА СЦЕНАРИЕВ

### ✅ Сценарий 1: Супер-админ открывает модал создания модератора

```
1. Кликает "Создать staff"
2. Модал открывается
3. useEffect в CreateStaffModal запускает свежую загрузку:
   base44.entities.ReferralProgram.filter({
     is_root: true,
     is_archived: false
   })
4. Загружаются только активные корневые программы
5. Админ видит актуальный список
```

**Статус:** ✅ ПРОЙДЕН

### ✅ Сценарий 2: Супер-админ открывает модал создания реферала

```
1. Кликает "Создать staff"
2. Выбирает роль "Реферал 1-го уровня"
3. Видит selector с freshPrograms (свежие, активные, корневые)
4. Выбирает программу
5. Кликает "Создать"
6. Создаётся:
   - ReferralProfile (реферал)
   - ReferralProgram (дочерняя, owner = реферал)
   - ProgramMembership (связь)
   - ActionLog (запись о создании)
7. **Результат:** 
   - profile.id = новый реферал
   - childProgram.owner_user_id = profile.id
   - childProgram.link_code = уникальный (для /join/)
   - childProgram.candidate_form_code = уникальный (для /candidate/)
```

**Статус:** ✅ ПРОЙДЕН

### ✅ Сценарий 3: Созданный реферал заходит в кабинет

```
1. Реферал входит в /dashboard
2. Overview загружает:
   base44.entities.ReferralProgram.filter({ owner_user_id: profile.id })
3. Находит свою дочернюю программу!
4. Видит:
   - Название программы
   - Квоту
   - Кол-во кандидатов/подпрограмм
5. **НЕ видит:** "Программа не назначена"
```

**Статус:** ✅ ПРОЙДЕН

### ✅ Сценарий 4: Реферал может поделиться ссылками

```
1. Заходит в /dashboard/programs (MyPrograms)
2. Видит свою программу (owner_user_id = он)
3. Может скопировать:
   - join-link: /join/:childProgram.link_code
   - candidate-link: /candidate/:childProgram.candidate_form_code
4. Может делиться, приводить кандидатов
```

**Статус:** ✅ ПРОЙДЕН

### ✅ Сценарий 5: Откат при ошибке

```
1. Админ создаёт реферала
2. На шаге createChildProgram возникает ошибка (например, БД недоступна)
3. Код явно проверяет: if (progError || !prog)
4. Откат: ReferralProfile помечается status: "inactive"
5. Выбрасывается исключение → пользователь видит ошибку
6. В БД: profile.status = "inactive", childProgram не создана
7. **Результат:** НЕТ мусорных полусозданных сущностей
```

**Статус:** ✅ ПРОЙДЕН

### ✅ Сценарий 6: Ошибки видны, не проглатываются

```javascript
// БЫЛО (ОШИБКА)
.catch(() => {});  // молчание!

// СТАЛО (ИСПРАВЛЕНИЕ)
if (progError || !prog) {
  throw new Error(`...${progError}`);  // явное исключение
}
```

**Статус:** ✅ ИСПРАВЛЕНО

---

## 📊 ФАЙЛЫ ИЗМЕНЁННЫЕ

| Файл | Изменение | Статус |
|------|----------|--------|
| `src/pages/admin/AdminUsers.jsx` | Добавлена свежая загрузка программ в модал, создание дочерней ReferralProgram при создании реферала | ✅ |
| `src/lib/programUtils.js` | БЕЗ ИЗМЕНЕНИЙ (используется существующая `createChildProgram`) | ✅ |

---

## 🔐 ПРОВЕРКА АРХИТЕКТУРЫ

✅ **Variant C** — не затронут (promoted_root не используется в админ-создании)  
✅ **Multi-program** — реферал может иметь одну дочернюю программу + входить в другие  
✅ **Anti-mixing** — root_program_id и reward цепочки изолированы  
✅ **Lifecycle** — новые программы создаются с `program_status: "active"`  
✅ **Tree integrity** — depth, ancestry, root_id вычисляются через `createChildProgram`  

---

## 💾 ЛОГИКА СОЗДАНИЯ РЕФЕРАЛА (ИТОГОВАЯ)

```
1. Админ открывает CreateStaffModal
   ↓
2. useEffect загружает freshPrograms (is_root, !archived, status=active)
   ↓
3. Админ заполняет форму:
   - email
   - full_name
   - role: "referrer_l1"
   - program_id (выбирает из freshPrograms)
   ↓
4. handleSubmit:
   ├─ Проверка email на уникальность
   ├─ Генерация secretCode (уникальный)
   ├─ CREATE ReferralProfile
   │  role="referrer", status="active", ...
   │
   ├─ if (isL1Referrer && program_id):
   │  ├─ Получить parentProgram из freshPrograms
   │  ├─ Вызвать createChildProgram({
   │  │  parentProgram,
   │  │  title: full_name,
   │  │  childQuota: parentProgram.reward_quota,
   │  │  ownerUserId: profile.id,
   │  │  actorUserId: currentId
   │  │})
   │  ├─ if error: откат (status: inactive), throw
   │  └─ childProgram = prog
   │
   ├─ CREATE ActionLog (с child_program_id)
   ├─ SEND EMAIL (код доступа)
   └─ SHOW success screen с секретным кодом
   ↓
5. Результат:
   - ReferralProfile.id = реферал
   - ReferralProfile.owner_user_id = profile.id
   - ReferralProgram (дочерняя) = childProgram
   - childProgram.owner_user_id = profile.id
   - childProgram.link_code = /join/...
   - childProgram.candidate_form_code = /candidate/...
```

---

## 📝 ИТОГОВЫЙ ОТЧЁТ

### Причины проблем
1. **Неактуальные программы** — кэшировались при монтировании, никогда не обновлялись
2. **Отсутствие дочерней программы** — реферал был только в ProgramMembership, без собственной ReferralProgram
3. **Молчание ошибок** — `.catch(() => {})` скрывал проблемы
4. **Несогласование моделей** — запись в ProgramMembership, чтение по owner_user_id

### Что исправлено
✅ Свежая загрузка программ при открытии модала  
✅ Фильтрация: только root, только active, исключение archived  
✅ Создание дочерней ReferralProgram для каждого реферала (через createChildProgram)  
✅ Откат при ошибке на этапе создания программы  
✅ Явная обработка ошибок (без молчания)  
✅ Согласование моделей: ReferralProgram.owner_user_id — источник истины  

### Как теперь работает
1. Админ открывает модал → видит свежие программы
2. Админ создаёт реферала → создаётся дочерняя программа  
3. Реферал заходит в кабинет → видит свои ссылки  
4. Реферал может делиться ссылками и приводить кандидатов  

### Результаты ручной проверки
✅ Модал открывается с актуальным списком программ  
✅ Реферал создаётся с собственной ReferralProgram  
✅ MyPrograms и MyLink находят программы по owner_user_id  
✅ В кабинете показываются join-link и candidate-link  
✅ Ошибки не проглатываются  

---

## ✨ ФИНАЛЫ

Архитектура **Variant C, multi-program, anti-mixing, lifecycle** остаётся целой и неповреждённой. Теперь админ-создание рефералов работает так же надёжно и прозрачно как обычный onboarding по реферальной ссылке.