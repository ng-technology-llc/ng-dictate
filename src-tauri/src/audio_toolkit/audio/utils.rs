use anyhow::Result;
use hound::{WavReader, WavSpec, WavWriter};
use log::debug;
use std::io::{Cursor, Seek, Write};
use std::path::Path;

/// Read a WAV file and return normalised f32 samples.
pub fn read_wav_samples<P: AsRef<Path>>(file_path: P) -> Result<Vec<f32>> {
    let reader = WavReader::open(file_path.as_ref())?;
    let samples = reader
        .into_samples::<i16>()
        .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
        .collect::<Result<Vec<f32>, _>>()?;
    Ok(samples)
}

/// Verify a WAV file by reading it back and checking the sample count.
pub fn verify_wav_file<P: AsRef<Path>>(file_path: P, expected_samples: usize) -> Result<()> {
    let reader = WavReader::open(file_path.as_ref())?;
    let actual_samples = reader.len() as usize;
    if actual_samples != expected_samples {
        anyhow::bail!(
            "WAV sample count mismatch: expected {}, got {}",
            expected_samples,
            actual_samples
        );
    }
    Ok(())
}

/// Save audio samples as a WAV file
pub fn save_wav_file<P: AsRef<Path>>(file_path: P, samples: &[f32]) -> Result<()> {
    let mut writer = WavWriter::create(file_path.as_ref(), wav_spec())?;
    write_wav_samples(&mut writer, samples)?;
    writer.finalize()?;
    debug!("Saved WAV file: {:?}", file_path.as_ref());
    Ok(())
}

/// Encode audio samples as WAV bytes.
pub fn encode_wav_bytes(samples: &[f32]) -> Result<Vec<u8>> {
    let mut cursor = Cursor::new(Vec::new());
    {
        let mut writer = WavWriter::new(&mut cursor, wav_spec())?;
        write_wav_samples(&mut writer, samples)?;
        writer.finalize()?;
    }
    Ok(cursor.into_inner())
}

fn wav_spec() -> WavSpec {
    WavSpec {
        channels: 1,
        sample_rate: 16000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    }
}

fn write_wav_samples<W: Write + Seek>(writer: &mut WavWriter<W>, samples: &[f32]) -> Result<()> {
    for sample in samples {
        writer.write_sample(sample_to_i16(*sample))?;
    }

    Ok(())
}

fn sample_to_i16(sample: f32) -> i16 {
    (sample * i16::MAX as f32) as i16
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn encode_wav_bytes_writes_16khz_mono_i16_samples() {
        let samples = vec![0.0_f32, 0.5, -0.5];
        let bytes = encode_wav_bytes(&samples).expect("encode wav");

        let reader = WavReader::new(Cursor::new(bytes)).expect("read wav");
        let spec = reader.spec();

        assert_eq!(spec.channels, 1);
        assert_eq!(spec.sample_rate, 16000);
        assert_eq!(spec.bits_per_sample, 16);
        assert_eq!(reader.duration(), 3);
    }
}
