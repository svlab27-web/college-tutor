# План семестра + уроки → читаемый документ для преподавателя и заказчика.
#   python3 scripts/plan-doc.py .   → docs/plan-python-1-semestr.md
# Источник правды — JSON в content/; документ только пересобираем, руками не правим.
import json, pathlib, re, sys
root = pathlib.Path(sys.argv[1])
plan = json.loads((root / "content/plans/python-1-semestr.json").read_text("utf-8"))
L = {p.stem: json.loads(p.read_text("utf-8")) for p in (root / "content/python").glob("*.json") if not p.name.endswith(".kk.json")}

o = []
w = o.append
w(f"# {plan['title']}\n")
w("> Документ собран из `content/plans/python-1-semestr.json` и уроков `content/python/*.json` — правки вносим в JSON, документ пересобираем: `python3 scripts/plan-doc.py .` "
  "Статус: **на проверке у преподавателя** (`review`).\n")
w(f"**Специальность:** {plan['specialty']}  \n**Курс / семестр:** {plan['course']} / {plan['semester']}  \n"
  f"**Часов:** {plan['hours_total']} ({plan['hours_per_week']} в неделю{', ' + str(plan['credits']) + ' кредита' if plan.get('credits') else ''})  \n**Итоговый контроль:** {plan['final_control']}\n")
w(f"{plan['note']}\n")
m = plan.get("method")
if m:
    w("## Как устроен курс\n")
    for line in m["lines"]:
        w(f"- {line}")
    w(f"\n**Проект.** {m['project']}\n")
    if m.get("core"):
        w(f"**Ядро и «по выбору».** {m['core']}\n")
    w(f"**Задачи.** {m['context']}\n")
w("## 1. План семестра (КТП)\n")
w("| Нед. | Тема | Часы | Студент знает | Студент умеет | Практическая работа | Проект (дома) | Повторяем недели | Уроки в сервисе |")
w("|---|---|---|---|---|---|---|---|---|")
for x in plan["weeks"]:
    les = "<br>".join(f"{L[s]['title']} (`{s}`)" for s in x["lessons"]) or "— (готовим по ходу семестра)"
    topic = x["topic"].replace(x["control"], f"**{x['control']}**") if x.get("control") else x["topic"]
    if x.get("hours_split"):
        topic += f" <br>*{x['hours_split']}*"
    if x.get("optional"):
        topic += "<br>Углублённо / по выбору: " + "; ".join(x["optional"])
    rev = ", ".join(map(str, x.get("review", []))) or "—"
    w(f"| {x['week']} | {topic} | {x['hours']} | {'; '.join(x['know'])} | {'; '.join(x['can'])} | {x.get('practice', '—')} | {x.get('project', '—')} | {rev} | {les} |")
w("")
w("## 2. Уроки первого месяца — подробно\n")
w("Каждый урок — 10–15 минут в Telegram: история → короткая теория → 3 шага с подсказками → самостоятельная задача без подсказок. "
  "У самостоятельной задачи несколько вариантов: сервер выдаёт студенту один, чтобы задачу нельзя было списать у соседа. "
  "Правильный ответ отмечен ✔ — в браузер студента ответы не уходят, их проверяет сервер.\n")
w("**Как помогает тьютор на каждом шаге:**")
w("- лестница из 3 подсказок по одной: намёк → наводящий вопрос → похожий пример (готовый ответ не даём);")
w("- «Объясни проще» — бытовое сравнение;")
w("- разбор типичной ошибки: на неверный ответ студент видит, *почему* он неверный;")
w("- задание «напиши код сам» — код запускается в браузере и проверяется тестами.\n")

N = 0
for x in plan["weeks"]:
    for s in x["lessons"]:
        N += 1
        les = L[s]
        w(f"### Неделя {x['week']} · урок {N}. {les['title']}\n")
        w(f"**Навык:** {les['skill']} · **время:** {les['minutes']} мин · файл `content/python/{s}.json`\n")
        w(f"**История.** {les['story']}\n")
        if les.get("material"):
            w(f"**Теория (на неё опирается тьютор).** {les['material']}\n")
        for i, st in enumerate(les["steps"], 1):
            tag = " · *самостоятельно, без подсказок*" if st.get("independent") else ""
            w(f"**Шаг {i}. {st['title']}**{tag}\n")
            w(st["prompt"].replace("\n", "  \n") + "\n")
            if st.get("code"):
                w("```python\n" + st["code"] + "\n```\n")
            if st["answer_type"] == "choice":
                for j, opt in enumerate(st["options"]):
                    mark = " ✔" if j == st["expected"] else ""
                    code = not re.match(r"[А-Яа-яЁё]", opt)
                    shown = " / ".join((f"`{p}`" if code else p) for p in opt.split("\n"))
                    w(f"- {shown}{mark}")
                w("")
            elif st["answer_type"] == "number":
                w(f"Ответ числом: **{st['expected']['value']}** ✔\n")
            if st.get("number_part"):
                w(f"Вторая часть: {st['number_part']['label']} — **{st['number_part']['expected']['value']}** ✔\n")
            if st.get("checks"):
                w("Программа проверяет выбор студента на значениях: " + ", ".join(f"{c['input']} → {c['expect']}" for c in st["checks"]) + ".\n")
            if st.get("hints"):
                w("Подсказки: " + " → ".join(f"«{h}»" for h in st["hints"]) + "\n")
            if st.get("simple"):
                w(f"Объясни проще: «{st['simple']}»\n")
            if st.get("common_mistakes"):
                w("Разбор ошибок:")
                for m in st["common_mistakes"]:
                    p = m["pattern"]
                    label = f"вариант «{st['options'][int(p)]}»" if st["answer_type"] == "choice" and p.isdigit() and int(p) < len(st.get("options", [])) else f"ответ {p}"
                    w(f"- {label.replace(chr(10), ' / ')}: {m['feedback']}")
                w("")
            for f in st.get("free_input", []):
                w(f"*Напиши код сам:* {f['prompt']}\n")
                if f.get("starter_code"):
                    w("Заготовка:\n```python\n" + f["starter_code"].rstrip() + "\n```\n")
                if f.get("tests"):
                    w("Тесты: " + "; ".join(("вывод на экран" if t["call"] == "__stdout__" else f"`{t['call']}`") + f" → `{json.dumps(t['expect'], ensure_ascii=False)}`" for t in f["tests"]) + "\n")
                if f.get("solution"):
                    w(f"Решение для преподавателя: {f['solution']}\n")
            if st.get("solution"):
                w(f"Решение для преподавателя: {st['solution']}\n")
            for k, v in enumerate(st.get("variants", []), 2):
                ans = v["options"][v["expected"]] if "options" in v else v["expected"]["value"]
                ans = ans.replace("\n", " / ") if isinstance(ans, str) else ans
                extra = f"; {v['number_part']['label']} — **{v['number_part']['expected']['value']}**" if v.get("number_part") else ""
                w(f"- Вариант {k}: {v['prompt'].replace(chr(10), ' · ')} → **{ans}**{extra}")
            if st.get("variants"):
                w("")
        w("---\n")

out = root / "docs/plan-python-1-semestr.md"
out.write_text("\n".join(o), "utf-8")
print(out, len(o), "строк")
