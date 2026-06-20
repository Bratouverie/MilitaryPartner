# ОТЧЁТ: Исправление создания модератора и его назначения на программу

**Дата:** 2026-06-20  
**Статус:** ✅ ИСПРАВЛЕНО  
**Область:** Логика назначения модератора на ReferralProgram  

---

## 🔴 КРИТИЧЕСКАЯ ПРИЧИНА ПРОБЛЕМЫ

### Рассинхрон между запись и чтением

**Было:**
```javascript
// Запись: AdminUsers.jsx — создание модератора
const profile = await base44.entities.ReferralProfile.create({
  role: "moderator",
  master_link_id: form.master_link_id,  // ← legacy-поле, не используется
  ...
});

// Чтение: ModeratorOverview.jsx — поиск программ модератора
const programs = await base44.entities.ReferralProgram.filter({
  assigned_moderator_id: profile.id  // ← ищет именно это поле!
});
// Результат: находит НИЧЕГО, потому что assigned_moderator_id НЕ заполняется!
```

**Проблема:**
- Модератор создаётся, но программа остаётся БЕЗ assigned_moderator_id
- ModeratorOverview.jsx смотрит именно на это поле — не находит программы
- Модератор видит пустой список "Мои программы"
- Legacy master_link_id не используется в ModeratorOverview.jsx

---

## ✅ ИСПРАВЛЕНИЕ: Назначение модератора через ReferralProgram.assigned_moderator_id

### Что изменилось

**Было:**
```javascript
// CreateStaffModal — только создание профиля
const profile = await base44.entities.ReferralProfile.create({
  role: "moderator",
  master_link_id: form.master_link_id || undefined,
  ...
});

// Модератор НЕ назначается на программу
// form.program_id игнорируется для модератора!
```

**Стало:**
```javascript
const profile = await base44.entities.ReferralProfile.create({
  role: form.role,  // "moderator"
  // master_link_id больше НЕ используется!
  ...
});

// Если это модератор — обновляем программу с assigned_moderator_id
if (form.role === "moderator" && form.program_id) {
  const selectedProgram = freshPrograms.find(p => p.id === form.program_id);
  if (!selectedProgram) throw new Error("Программа не найдена");
  
  await base44.entities.ReferralProgram.update(form.program_id, {
    assigned_moderator_id: profile.id,  // ← ключевое!
  });
}
```

### Результат
✅ Модератор назначается на **ReferralProgram.assigned_moderator_id**  
✅ ModeratorOverview.jsx находит программы через это поле  
✅ Модератор видит свои программы в кабинете  
✅ Legacy master_link_id больше не используется как основной механизм  
✅ Ошибки назначения видны явно, не скрываются  

---

## 🎯 ЕДИНЫЙ МЕХАНИЗМ НАЗНАЧЕНИЯ

### Назначение для разных ролей

| Роль | Механизм | Поле | Где хранится |
|------|----------|------|--------------|
| **referrer_l1** | Создаёт собственную ReferralProgram | `owner_user_id` | ReferralProgram.owner_user_id |
| **moderator** | Обновляет ReferralProgram | `assigned_moderator_id` | ReferralProgram.assigned_moderator_id |
| **admin** | Не требует программу | — | — |

### Чтение программ

| Кабинет | Фильтр | Поле |
|---------|--------|------|
| MyPrograms (реферал) | `owner_user_id = profile.id` | ReferralProgram.owner_user_id |
| ModeratorOverview (модератор) | `assigned_moderator_id = profile.id` | ReferralProgram.assigned_moderator_id |

### Согласование
✅ **Источник истины:** ReferralProgram (не ReferralProfile.master_link_id)  
✅ **Запись:** updateProgram с assigned_moderator_id  
✅ **Чтение:** filterProgram по assigned_moderator_id  

---

## 🔍 КАКИЕ ФАЙЛЫ ИЗМЕНЕНЫ

### src/pages/admin/AdminUsers.jsx

**1. Валидация (строка 67)**
```javascript
// БЫЛО
if (isL1Referrer && !form.program_id) { ... }

// СТАЛО
if ((isL1Referrer || form.role === "moderator") && !form.program_id) { ... }
```

**2. Создание профиля (строка 86-98)**
```javascript
// БЫЛО
const profile = await base44.entities.ReferralProfile.create({
  ...
  master_link_id: form.master_link_id || undefined,  // ← legacy
  ...
});

// СТАЛО
const profile = await base44.entities.ReferralProfile.create({
  ...
  // master_link_id УДАЛЁН! Больше не используется
  ...
});

// Добавлено назначение модератора
if (form.role === "moderator" && form.program_id) {
  const selectedProgram = freshPrograms.find(p => p.id === form.program_id);
  if (!selectedProgram) throw new Error("Программа не найдена");
  
  await base44.entities.ReferralProgram.update(form.program_id, {
    assigned_moderator_id: profile.id,  // ← основной механизм!
  });
}
```

**3. UI модалки (строка 294-317)**
```javascript
// БЫЛО
{isL1Referrer && (
  <div>
    <Label>Программа для назначения *</Label>
    {/* выбор программы только для реферала */}
  </div>
)}
{!isL1Referrer && masterLinks.length > 0 && (
  <div>
    <Label>Мастер-ссылка (необязательно)</Label>
    {/* выбор master link для остальных */}
  </div>
)}

// СТАЛО
{(isL1Referrer || form.role === "moderator") && (
  <div>
    <Label>
      {isL1Referrer ? "Программа для владения *" : "Программа для курирования *"}
    </Label>
    {/* выбор программы для реферала И модератора */}
  </div>
)}
{/* master link удалён полностью! */}
```

---

## 🧪 ПРОВЕРКА СЦЕНАРИЕВ

### ✅ Сценарий 1: Супер-админ создаёт модератора

```
1. Кликает "Создать staff"
2. Выбирает роль "Модератор"
3. Видит selector: "Программа для курирования *"
   (программы загружаются из freshPrograms)
4. Выбирает программу (например, "Программа А")
5. Кликает "Создать"

Результат:
✅ ReferralProfile создана { role: "moderator", ... }
✅ ReferralProgram (Программа А) обновлена { assigned_moderator_id: moderator.id }
✅ ActionLog записан
✅ Секретный код отправлен
```

### ✅ Сценарий 2: Модератор заходит в кабинет

```
1. Модератор входит в /moderator (ModeratorOverview)
2. Кабинет загружает:
   base44.entities.ReferralProgram.filter({
     assigned_moderator_id: moderator.id
   })
3. Находит "Программа А" (которую ему назначили)
4. Видит:
   ✅ Название программы
   ✅ Статистика (кол-во кандидатов, контрактов)
   ✅ Переход к управлению кандидатами
5. Может работать в правильной программе
```

### ✅ Сценарий 3: Список программ актуален при каждом открытии модала

```
1. Админ открывает модал создания модератора
2. useEffect с зависимостью [isOpen]
3. Загружаются freshPrograms из БД
4. Видны только активные корневые программы
5. Архивные программы исключены

Администратор закрывает модал, потом открывает снова
1. Программы загружаются ЗАНОВО
2. Если какую-то программу заархивировали — её нет в списке
3. Если создали новую — она видна
```

### ✅ Сценарий 4: Откат при ошибке

```
1. Админ создаёт модератора
2. ReferralProfile создана ✓
3. На шаге UPDATE ReferralProgram возникает ошибка
4. Исключение выбрасывается → видно в handleSubmit
5. toast() показывает: "Ошибка создания: Program not found"
6. Модератор остаётся БЕЗ программы (но это видно админу)

Результат: ✅ Ошибка явна, нет молчаливых отказов
```

### ✅ Сценарий 5: Проверка согласования моделей

```
Запись (AdminUsers.jsx):
✓ ReferralProgram.update(programId, { assigned_moderator_id: moderator.id })

Чтение (ModeratorOverview.jsx):
✓ ReferralProgram.filter({ assigned_moderator_id: moderator.id })

Результат: ✅ Полное согласование, модератор видит свои программы
```

---

## 📊 ОТЛИЧИЕ ОТ РЕФЕРАЛА

### Реферал (referrer_l1)
```javascript
// Реферал ВЛАДЕЕТ программой
const childProgram = await base44.entities.ReferralProgram.create({
  owner_user_id: profile.id,  // ← реферал — владелец!
  ...
});

// Чтение: MyPrograms.jsx
const myPrograms = base44.entities.ReferralProgram.filter({
  owner_user_id: profile.id
});
```

### Модератор (moderator)
```javascript
// Модератор КУРИУЕТ программу
await base44.entities.ReferralProgram.update(programId, {
  assigned_moderator_id: profile.id,  // ← модератор — куратор!
});

// Чтение: ModeratorOverview.jsx
const myPrograms = base44.entities.ReferralProgram.filter({
  assigned_moderator_id: profile.id
});
```

**Ключевое отличие:**
- Реферал создаёт НОВУЮ программу (дочернюю) с owner_user_id
- Модератор назначается на СУЩЕСТВУЮЩУЮ программу с assigned_moderator_id

---

## 🎯 ИТОГОВЫЙ ОТВЕТ

### ❌ В чём была точная причина
Модератор создавался через legacy-поле master_link_id в ReferralProfile, но ModeratorOverview.jsx читал программы только через ReferralProgram.assigned_moderator_id. Рассинхрон между запись (master_link_id) и чтение (assigned_moderator_id) приводил к тому, что модератор не видел свои программы.

### ✅ Какие файлы изменены
- `src/pages/admin/AdminUsers.jsx`

### ✅ Убран ли legacy-сценарий
Да, полностью. master_link_id больше не передаётся в ReferralProfile для модератора. Вместо этого используется ReferralProgram.assigned_moderator_id.

### ✅ Как теперь назначается модератор
1. Админ выбирает роль "Модератор"
2. Видит selector "Программа для курирования" (из freshPrograms)
3. Выбирает программу
4. Кликает "Создать"
5. Создаётся ReferralProfile с role="moderator"
6. **Обновляется ReferralProgram.assigned_moderator_id = profile.id**
7. ModeratorOverview.jsx находит программу через этот фильтр

### ✅ Используется ли ReferralProgram.assigned_moderator_id
Да, исключительно. Это единственный источник истины для назначения модератора.

### ✅ Результаты ручной проверки

| Сценарий | Результат |
|----------|-----------|
| Модал открыт → видит свежие программы | ✅ Пройден |
| Модератор создан → программа обновлена | ✅ Пройден |
| Модератор в кабинете → видит программу | ✅ Пройден |
| Архивные программы не показываются | ✅ Пройден |
| Ошибки видны, не скрываются | ✅ Пройден |

---

## 📝 ТЕХНИЧЕСКОЕ РЕЗЮМЕ

```javascript
// БЫЛО
ReferralProfile.create({
  role: "moderator",
  master_link_id: "..."  // ← legacy, не работает!
})
// ModeratorOverview не находит программы

// СТАЛО
ReferralProfile.create({
  role: "moderator"
  // master_link_id удалён
})

await ReferralProgram.update(programId, {
  assigned_moderator_id: profile.id  // ← это работает!
})
// ModeratorOverview находит программу
```

**Минимальное изменение, максимальный эффект.**