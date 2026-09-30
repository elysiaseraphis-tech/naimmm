'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {parse} = require('../exif-metadata.js');

test('preserves every v4 character prompt, negative prompt, coordinate, and order', () => {
  const longPrompt = 'long prompt '.repeat(30);
  const metadata = {
    Description: 'fallback description',
    Comment: JSON.stringify({
      v4_prompt: {
        use_coords: true,
        caption: {
          base_caption: 'positive base',
          char_captions: [
            {char_caption: longPrompt, centers: [{x:0.1, y:0.2}]},
            {char_caption: 'second character', centers: [{x:0.8, y:0.7}]},
            {char_caption: 'third character', centers: [{x:0.4, y:0.6}]}
          ]
        }
      },
      v4_negative_prompt: {
        caption: {
          base_caption: 'negative base',
          char_captions: [
            {char_caption: 'first negative'},
            {char_caption: 'second negative'},
            {char_caption: 'third negative'}
          ]
        }
      }
    })
  };

  const parsed = parse(metadata);
  assert.equal(parsed.prompt, 'fallback description');
  assert.equal(parsed.negativePrompt, 'negative base');
  assert.equal(parsed.characters.length, 3);
  assert.equal(parsed.characters[0].prompt, longPrompt);
  assert.equal(parsed.characters[1].uc, 'second negative');
  assert.deepEqual(parsed.characters[2].pos, {x:0.4, y:0.6});
  assert.equal(parsed.useCoords, true);
});

test('normalizes nested positive and negative character prompt structures', () => {
  const parsed = parse({
    Comment: JSON.stringify({
      prompt: {caption: 'nested base'},
      negative_prompt: {text: 'nested negative'},
      characterPrompts: [
        {positive: {text: 'one'}, negative: {text: 'bad one'}},
        {prompt: {caption: 'two'}, uc: 'bad two'}
      ]
    })
  });

  assert.equal(parsed.prompt, 'nested base');
  assert.equal(parsed.negativePrompt, 'nested negative');
  assert.deepEqual(parsed.characters.map(({prompt, uc}) => ({prompt, uc})), [
    {prompt:'one', uc:'bad one'},
    {prompt:'two', uc:'bad two'}
  ]);
});
