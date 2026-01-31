import os
from elevenlabs.client import ElevenLabs

client = ElevenLabs(api_key=os.environ["ELEVEN_API_KEY"])

audio = client.text_to_speech.convert(
    voice_id="VOICE_ID_HERE",
    model_id="eleven_multilingual_v2",
    text="これはJudgmentのデモ用ナレーションです。"
)

with open("narration.mp3", "wb") as f:
    # convert() は bytes か iterator を返す実装があるので両対応
    if isinstance(audio, (bytes, bytearray)):
        f.write(audio)
    else:
        for chunk in audio:
            f.write(chunk)
