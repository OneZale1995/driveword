/**
 * 英语音节拆解 + 发音规则引擎
 *
 * 用规则法将单词拆分为音节，并识别常见发音特征，
 * 替代原来的逐字母拼读（A-B-C），改为按音节朗读 + 中文发音提示。
 */

// ──────────────────────────────────────────────
// 常量
// ──────────────────────────────────────────────

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y'])

/** 辅音二合字母（不可拆开） */
const CONSONANT_DIGRAPHS = new Set([
  'th', 'ch', 'sh', 'ph', 'wh', 'ck', 'ng', 'nk', 'gh', 'tch', 'dge',
])

/** 不发音字母模式 */
const SILENT_PATTERNS: Array<{ regex: RegExp; note: string }> = [
  { regex: /^kn/i, note: '开头 K 不发音' },
  { regex: /^wr/i, note: '开头 W 不发音' },
  { regex: /^gn/i, note: '开头 G 不发音' },
  { regex: /^ps/i, note: '开头 P 不发音' },
  { regex: /^rh/i, note: '开头 H 不发音' },
  { regex: /^mb$/i, note: '结尾 B 不发音' },
  { regex: /mb$/i, note: '结尾 B 不发音' },
  { regex: /ght$/i, note: 'gh 不发音，e 不发音' },
]

/** 常见后缀发音 */
const SUFFIX_PATTERNS: Array<{ regex: RegExp; note: string }> = [
  { regex: /tion$/i, note: 'tion 发 /ʃən/' },
  { regex: /sion$/i, note: 'sion 发 /ʒən/' },
  { regex: /ture$/i, note: 'ture 发 /tʃər/' },
  { regex: /sure$/i, note: 'sure 发 /ʒər/' },
  { regex: /ous$/i, note: 'ous 发 /əs/' },
  { regex: /ful$/i, note: 'ful 发 /fʊl/' },
  { regex: /ness$/i, note: 'ness 名词后缀，发 /nəs/' },
  { regex: /ment$/i, note: 'ment 名词后缀' },
  { regex: /able$/i, note: 'able 形容词后缀，发 /eɪbəl/' },
  { regex: /ible$/i, note: 'ible 形容词后缀，发 /ɪbəl/' },
  { regex: /ly$/i, note: 'ly 副词后缀' },
  { regex: /less$/i, note: 'less 表示"无"' },
  { regex: /ness$/i, note: 'ness 表示状态' },
  { regex: /tion$/i, note: 'tion 发 /ʃən/' },
]

/** 元音组合发音 */
const VOWEL_TEAM_PATTERNS: Array<{ regex: RegExp; note: string }> = [
  { regex: /igh/i, note: 'igh 发 /aɪ/，如 high' },
  { regex: /eigh/i, note: 'eigh 发 /eɪ/，如 eight' },
  { regex: /aigh/i, note: 'aigh 发 /eɪ/，如 straight' },
  { regex: /ought/i, note: 'ough 发 /ɔːt/，如 bought' },
  { regex: /augh/i, note: 'augh 发 /ɔː/，如 caught' },
  { regex: /ea[^r]/i, note: 'ea 常发 /iː/，如 eat' },
  { regex: /ee/i, note: 'ee 发 /iː/，如 see' },
  { regex: /oo/i, note: 'oo 发 /uː/ 或 /ʊ/' },
  { regex: /oa/i, note: 'oa 发 /oʊ/，如 boat' },
  { regex: /ai(?!r)/i, note: 'ai 发 /eɪ/，如 rain' },
  { regex: /ay/i, note: 'ay 发 /eɪ/，如 day' },
  { regex: /oi/i, note: 'oi 发 /ɔɪ/，如 oil' },
  { regex: /oy/i, note: 'oy 发 /ɔɪ/，如 boy' },
  { regex: /ou(?!t)/i, note: 'ou 发 /aʊ/，如 out' },
  { regex: /ow/i, note: 'ow 发 /aʊ/ 或 /oʊ/' },
  { regex: /au(?!t)/i, note: 'au 发 /ɔː/，如 auto' },
  { regex: /aw/i, note: 'aw 发 /ɔː/，如 law' },
  { regex: /ew/i, note: 'ew 发 /uː/ 或 /juː/' },
  { regex: /ue/i, note: 'ue 发 /uː/，如 blue' },
  { regex: /ie(?!$)/i, note: 'ie 发 /iː/ 或 /aɪ/' },
]

/** R 控制元音 */
const R_CONTROLLED_PATTERNS: Array<{ regex: RegExp; note: string }> = [
  { regex: /air/i, note: 'air 发 /er/' },
  { regex: /ear(?!n)/i, note: 'ear 发 /ɪr/，如 hear' },
  { regex: /eir/i, note: 'eir 发 /ɪr/' },
  { regex: /oir/i, note: 'oir 发 /ɔɪr/' },
  { regex: /ar(?!e)/i, note: 'ar 发 /ɑːr/，如 car' },
  { regex: /er(?![ao])/i, note: 'er 发 /ɜːr/ 或 /ər/' },
  { regex: /ir(?!e)/i, note: 'ir 发 /ɜːr/，如 bird' },
  { regex: /or(?!e)/i, note: 'or 发 /ɔːr/，如 for' },
  { regex: /ur/i, note: 'ur 发 /ɜːr/，如 turn' },
]

/** 辅音二合字母发音 */
const DIGRAPH_PATTERNS: Array<{ regex: RegExp; note: string }> = [
  { regex: /ph/i, note: 'ph 发 /f/' },
  { regex: /gh(?!t)/i, note: 'gh 常不发音' },
  { regex: /ck/i, note: 'ck 发 /k/' },
  { regex: /ch/i, note: 'ch 发 /tʃ/' },
  { regex: /sh/i, note: 'sh 发 /ʃ/' },
  { regex: /th/i, note: 'th 发 /θ/ 或 /ð/' },
  { regex: /ng$/i, note: 'ng 发 /ŋ/' },
  { regex: /qu/i, note: 'qu 发 /kw/' },
  { regex: /wh/i, note: 'wh 发 /w/ 或 /h/' },
]

// ──────────────────────────────────────────────
// 音节拆解
// ──────────────────────────────────────────────

function isVowel(ch: string): boolean {
  return VOWELS.has(ch.toLowerCase())
}

/**
 * 将英语单词拆分为音节
 *
 * 算法：
 * 1. 找到所有元音组（连续元音算一组）
 * 2. 处理词尾不发音的 e
 * 3. 根据元音组间的辅音数量决定切分位置
 *    - 1 个辅音：V-CV（辅音归后）
 *    - 2 个辅音：VC-CV（中间切开，除非是二合字母）
 *    - 3+ 个辅音：保持二合字母完整
 *
 * @example
 * splitSyllables('abandon') → ['a', 'ban', 'don']
 * splitSyllables('computer') → ['com', 'pu', 'ter']
 * splitSyllables('beautiful') → ['beau', 'ti', 'ful']
 * splitSyllables('cat') → ['cat']
 */
export function splitSyllables(word: string): string[] {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')

  // 太短不需要拆
  if (w.length <= 3) return [w]

  // 找元音组
  interface VowelGroup {
    start: number
    end: number
  }
  const groups: VowelGroup[] = []
  let i = 0

  while (i < w.length) {
    if (isVowel(w[i])) {
      const start = i
      // 连续元音归为一组
      while (i + 1 < w.length && isVowel(w[i + 1])) {
        i++
      }
      groups.push({ start, end: i })
    }
    i++
  }

  // 没有元音或只有一个元音组 → 单音节
  if (groups.length <= 1) return [w]

  // 处理词尾不发音的 e（magic e / silent e）
  // 规则：最后一个元音组是单个 e 且在词尾，前面有 1-2 个辅音
  if (groups.length >= 2) {
    const last = groups[groups.length - 1]
    const prev = groups[groups.length - 2]
    if (
      last.start === last.end && // 单个字母
      last.start === w.length - 1 && // 在词尾
      w[last.start] === 'e' &&
      prev.end < w.length - 2 && // 前面有辅音
      !isVowel(w[w.length - 2])
    ) {
      groups.pop()
    }
  }

  if (groups.length <= 1) return [w]

  // 在元音组之间切分
  const syllables: string[] = []
  let syllableStart = 0

  for (let g = 0; g < groups.length - 1; g++) {
    const consonantStart = groups[g].end + 1
    const consonantEnd = groups[g + 1].start - 1
    const consonantCount = consonantEnd - consonantStart + 1

    let splitPos: number

    if (consonantCount <= 0) {
      // 元音相邻（如 ia, io），不切分
      continue
    } else if (consonantCount === 1) {
      // VCV → V-CV（辅音归后一音节）
      splitPos = consonantStart
    } else if (consonantCount === 2) {
      // VCCV → 检查是否二合字母
      const pair = w.slice(consonantStart, consonantStart + 2)
      if (CONSONANT_DIGRAPHS.has(pair)) {
        // 二合字母不可拆，辅音归后
        splitPos = consonantStart
      } else {
        // 中间切开
        splitPos = consonantStart + 1
      }
    } else {
      // 3+ 辅音：保持二合字母完整
      const pair = w.slice(consonantStart, consonantStart + 2)
      if (CONSONANT_DIGRAPHS.has(pair)) {
        splitPos = consonantStart + 2
      } else {
        const pair2 = w.slice(consonantStart + 1, consonantStart + 3)
        if (CONSONANT_DIGRAPHS.has(pair2)) {
          splitPos = consonantStart + 1
        } else {
          splitPos = consonantStart + Math.floor(consonantCount / 2)
        }
      }
    }

    if (splitPos > syllableStart) {
      syllables.push(w.slice(syllableStart, splitPos))
      syllableStart = splitPos
    }
  }

  syllables.push(w.slice(syllableStart))
  return syllables.filter((s) => s.length > 0)
}

// ──────────────────────────────────────────────
// 发音规则识别
// ──────────────────────────────────────────────

/**
 * 识别单词中值得提示的发音特征
 * 返回中文提示文本，无特征则返回 null
 */
export function getPhoneticNote(word: string): string | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')

  if (w.length < 2) return null

  const notes: string[] = []

  // 1. Magic E（最高优先级，最常见拼写规则）
  if (w.length > 3 && /[aeiou][bcdfghjklmnpqrstvwxz]e$/.test(w)) {
    notes.push('结尾 E 不发音，前元音读字母音')
  }

  // 2. 双写辅音
  const doubleMatch = w.match(/([bcdfghjklmnprst])\1/)
  if (doubleMatch && !/ll$|ss$|ff$/.test(w)) {
    notes.push(`双写 ${doubleMatch[1].toUpperCase()}`)
  }

  // 3. 不发音字母
  for (const { regex, note } of SILENT_PATTERNS) {
    if (regex.test(w)) {
      notes.push(note)
      break // 只取一个
    }
  }

  // 4. 后缀发音
  for (const { regex, note } of SUFFIX_PATTERNS) {
    if (regex.test(w)) {
      notes.push(note)
      break
    }
  }

  // 5. 元音组合
  for (const { regex, note } of VOWEL_TEAM_PATTERNS) {
    if (regex.test(w)) {
      notes.push(note)
      break
    }
  }

  // 6. R 控制元音
  for (const { regex, note } of R_CONTROLLED_PATTERNS) {
    if (regex.test(w)) {
      notes.push(note)
      break
    }
  }

  // 7. 辅音二合字母（最低优先级）
  if (notes.length === 0) {
    for (const { regex, note } of DIGRAPH_PATTERNS) {
      if (regex.test(w)) {
        notes.push(note)
        break
      }
    }
  }

  return notes.length > 0 ? notes.join('；') : null
}

// ──────────────────────────────────────────────
// 音节朗读文本生成
// ──────────────────────────────────────────────

/**
 * 为 TTS 生成音节朗读序列
 *
 * 返回一个数组，每个元素是一个 { text, lang } 对，
 * 调用方按顺序逐个朗读即可。
 *
 * @example
 * buildSyllableSpeech('abandon')
 * → [
 *     { text: 'a', lang: 'en' },
 *     { text: 'ban', lang: 'en' },
 *     { text: 'don', lang: 'en' },
 *     { text: '3个音节', lang: 'zh' },  // 音节数提示
 *     { text: '注意 ban 中的 a 发梅花音', lang: 'zh' }, // 发音规则（如有）
 *   ]
 */
export function buildSyllableSpeech(
  word: string,
): Array<{ text: string; lang: 'en' | 'zh' }> {
  const result: Array<{ text: string; lang: 'en' | 'zh' }> = []
  const syllables = splitSyllables(word)

  // 多音节才逐个朗读，单音节直接跳过
  if (syllables.length > 1) {
    // 音节数提示
    result.push({ text: `${syllables.length}个音节`, lang: 'zh' })

    // 逐音节朗读
    for (const syl of syllables) {
      result.push({ text: syl, lang: 'en' })
    }
  }

  // 发音规则提示
  const note = getPhoneticNote(word)
  if (note) {
    result.push({ text: note, lang: 'zh' })
  }

  return result
}
