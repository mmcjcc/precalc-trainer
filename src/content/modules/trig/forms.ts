/** Spellings of an exact answer that grade right, shared by the second half's templates. */
import { exactAscii, exactSay, exactText, type TrigExact } from '@/engine/trig'

/** Every spelling of an exact value that grades right: glyphs, keyboard, sentence, and a decimal that ends. */
export function exactForms(v: TrigExact): string[] {
  const forms = [exactText(v), exactAscii(v), exactSay(v)]
  if (v.root === 1 && v.pi === 0 && v.c.d !== 1) {
    let d = v.c.d
    while (d % 2 === 0) d /= 2
    while (d % 5 === 0) d /= 5
    if (d === 1) forms.push(String(v.c.n / v.c.d))
  }
  return [...new Set(forms)]
}
