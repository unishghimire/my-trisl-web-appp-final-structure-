import fs from 'fs';

const filePath = 'src/views/Profile.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  {
    label: /<label className="text-\[10px\] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">([\s\S]*?)In-Game ID \(UID\)([\s\S]*?)<\/label>/g,
    newLabel: '<label htmlFor="profileInGameId" className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">$1In-Game ID (UID)$2</label>',
    inputType: 'type="text"',
    inputValue: 'value={inGameId}',
    inputId: 'id="profileInGameId"\n                                        type="text"'
  },
  {
    label: /<label className="text-\[10px\] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">([\s\S]*?)In-Game Name/g,
    newLabel: '<label htmlFor="profileInGameName" className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">$1In-Game Name',
    inputType: 'type="text"',
    inputValue: 'value={inGameName}',
    inputId: 'id="profileInGameName"\n                                        type="text"'
  },
  {
    label: /<label className="text-\[10px\] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">([\s\S]*?)Team Name/g,
    newLabel: '<label htmlFor="profileTeamName" className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">$1Team Name',
    inputType: 'type="text"',
    inputValue: 'value={teamName}',
    inputId: 'id="profileTeamName"\n                                        type="text"'
  },
  {
    label: /<label className="text-\[10px\] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">([\s\S]*?)Organization Name/g,
    newLabel: '<label htmlFor="profileOrgName" className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">$1Organization Name',
    inputType: 'type="text"',
    inputValue: 'value={orgName}',
    inputId: 'id="profileOrgName"\n                                                type="text"'
  },
  {
    label: /<label className="text-\[10px\] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">([\s\S]*?)WhatsApp/g,
    newLabel: '<label htmlFor="profileWhatsApp" className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">$1WhatsApp',
    inputType: 'type="text"',
    inputValue: 'value={orgWhatsapp}',
    inputId: 'id="profileWhatsApp"\n                                                type="text"'
  },
  {
    label: /<label className="text-\[10px\] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">([\s\S]*?)Discord/g,
    newLabel: '<label htmlFor="profileDiscord" className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">$1Discord',
    inputType: 'type="text"',
    inputValue: 'value={orgDiscord}',
    inputId: 'id="profileDiscord"\n                                                type="text"'
  },
  {
    label: /<label className="text-\[10px\] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">([\s\S]*?)YouTube/g,
    newLabel: '<label htmlFor="profileYouTube" className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">$1YouTube',
    inputType: 'type="text"',
    inputValue: 'value={orgYoutube}',
    inputId: 'id="profileYouTube"\n                                                type="text"'
  },
  {
    label: /<label className="text-\[10px\] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">([\s\S]*?)Phone Number/g,
    newLabel: '<label htmlFor="profilePhone" className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">$1Phone Number',
    inputType: 'type="tel"',
    inputValue: 'value={phone}',
    inputId: 'id="profilePhone"\n                                        type="tel"'
  },
  {
    label: /<label className="text-\[10px\] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">([\s\S]*?)Bio \/ Description/g,
    newLabel: '<label htmlFor="profileBio" className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">$1Bio / Description',
    inputType: 'value={bio}',
    inputValue: 'onChange={(e) => setBio(e.target.value)}',
    inputId: 'id="profileBio"\n                                        value={bio}'
  },
  {
    label: /<label className="text-\[10px\] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">([\s\S]*?)Skills \(Comma separated\)/g,
    newLabel: '<label htmlFor="profileSkills" className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">$1Skills (Comma separated)',
    inputType: 'type="text"',
    inputValue: 'value={skills}',
    inputId: 'id="profileSkills"\n                                        type="text"'
  },
  {
    label: /<label className="text-\[10px\] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">([\s\S]*?)Status/g,
    newLabel: '<label htmlFor="profileStatus" className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">$1Status',
    inputType: 'value={status}',
    inputValue: 'onChange={(e) => setStatus(e.target.value as any)}',
    inputId: 'id="profileStatus"\n                                            value={status}'
  },
  {
    label: /<label className="text-\[10px\] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">([\s\S]*?)Custom Activity/g,
    newLabel: '<label htmlFor="profileCustomActivity" className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">$1Custom Activity',
    inputType: 'type="text"',
    inputValue: 'value={customActivity}',
    inputId: 'id="profileCustomActivity"\n                                            type="text"'
  }
];

replacements.forEach(({ label, newLabel, inputType, inputValue, inputId }) => {
  content = content.replace(label, newLabel);
  // find input by inputType and inputValue together to ensure uniqueness (mostly)
  // or simply replace the inputType inside the specific block.
  content = content.replace(new RegExp(inputType + '\\s*\\n\\s*' + inputValue.replace(/([()\[\]{}])/g, '\\$1'), 'g'), inputId + '\n                                        ' + inputValue);
});

fs.writeFileSync(filePath, content);
console.log('done');
