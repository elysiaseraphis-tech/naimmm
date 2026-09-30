(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.NAIMExif = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  function firstText(value, keys){
    if(typeof value === 'string') return value;
    if(!value || typeof value !== 'object') return '';
    for(const key of keys){
      const found = value[key];
      if(typeof found === 'string') return found;
      if(found && typeof found === 'object'){
        const nested = firstText(found, keys);
        if(nested) return nested;
      }
    }
    return '';
  }

  function normalizeCharacter(ch, negative){
    if(typeof ch === 'string') ch = {prompt: ch};
    ch = ch && typeof ch === 'object' ? ch : {};
    negative = negative && typeof negative === 'object' ? negative : {};
    const centers = ch.centers || (ch.position && [ch.position]) || [];
    const center = Array.isArray(centers) ? centers[0] : centers;
    const negativeValue = ch.uc || ch.neg || ch.negative_prompt || ch.negative;
    return {
      prompt: firstText(ch, ['prompt', 'char_caption', 'positive_prompt', 'positive', 'caption', 'text']),
      uc: firstText(negativeValue, ['uc', 'neg', 'negative_prompt', 'negative', 'caption', 'text', 'prompt', 'char_caption']) ||
          firstText(negative, ['uc', 'neg', 'negative_prompt', 'negative', 'char_caption', 'caption', 'text']),
      pos: center && Number.isFinite(Number(center.x)) && Number.isFinite(Number(center.y))
        ? {x:Number(center.x), y:Number(center.y)}
        : {x:0.5, y:0.5}
    };
  }

  function parse(meta){
    meta = meta && typeof meta === 'object' ? meta : {};
    let raw = {};
    if(meta.Comment && typeof meta.Comment === 'string'){
      try{ raw = JSON.parse(meta.Comment); }catch(_){}
    } else if(meta.Comment && typeof meta.Comment === 'object'){
      raw = meta.Comment;
    }

    const positiveCaption = raw.v4_prompt && raw.v4_prompt.caption;
    const negativeCaption = raw.v4_negative_prompt && raw.v4_negative_prompt.caption;
    const prompt = meta.Description || firstText(raw, ['input', 'prompt', 'caption', 'text']) ||
      firstText(positiveCaption, ['base_caption', 'caption', 'prompt']);
    const negativePrompt = firstText(raw, ['uc', 'negative_prompt', 'caption', 'text']) ||
      firstText(negativeCaption, ['base_caption', 'caption', 'prompt']);

    let chars = raw.characterPrompts;
    if(!Array.isArray(chars) || chars.length === 0) chars = raw.characters;
    let negatives = [];
    if(!Array.isArray(chars) || chars.length === 0){
      chars = positiveCaption && positiveCaption.char_captions;
      negatives = (negativeCaption && negativeCaption.char_captions) || [];
    }
    chars = Array.isArray(chars) ? chars : [];

    return {
      raw,
      prompt: prompt || '',
      negativePrompt: negativePrompt || '',
      characters: chars.map((ch, index) => normalizeCharacter(ch, negatives[index])),
      useCoords: raw.v4_prompt && raw.v4_prompt.use_coords !== undefined
        ? !!raw.v4_prompt.use_coords
        : false
    };
  }

  return {parse, normalizeCharacter};
});
