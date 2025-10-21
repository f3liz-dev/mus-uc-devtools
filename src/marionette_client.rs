use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::time::Duration;

#[derive(Debug)]
pub struct MarionetteClient {
    stream: TcpStream,
    message_id: u32,
}

#[derive(Debug, serde::Deserialize)]
struct MarionetteHandshake {
    #[serde(rename = "marionetteProtocol")]
    protocol: u32,
    #[serde(rename = "applicationType")]
    application_type: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct MarionetteMessage {
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<u32>,
    name: String,
    parameters: Value,
}

impl MarionetteClient {
    pub fn connect(host: &str, port: u16) -> Result<Self, Box<dyn std::error::Error>> {
        let stream = TcpStream::connect((host, port))?;
        stream.set_read_timeout(Some(Duration::from_secs(60)))?;
        stream.set_write_timeout(Some(Duration::from_secs(60)))?;

        // Read handshake
        let mut reader = BufReader::new(stream.try_clone()?);
        let mut handshake_line = String::new();
        reader.read_line(&mut handshake_line)?;

        let handshake: MarionetteHandshake = serde_json::from_str(&handshake_line)?;

        if handshake.application_type != "gecko" {
            return Err(format!(
                "Unexpected application type: {}",
                handshake.application_type
            )
            .into());
        }

        if handshake.protocol != 3 {
            return Err(format!("Unsupported protocol version: {}", handshake.protocol).into());
        }

        Ok(MarionetteClient {
            stream,
            message_id: 0,
        })
    }

    pub fn send_command(
        &mut self,
        name: &str,
        params: Value,
    ) -> Result<Value, Box<dyn std::error::Error>> {
        self.message_id += 1;

        let msg = MarionetteMessage {
            id: Some(self.message_id),
            name: name.to_string(),
            parameters: params,
        };

        let msg_str = serde_json::to_string(&msg)?;
        write!(self.stream, "{}:{}", msg_str.len(), msg_str)?;
        self.stream.flush()?;

        let mut reader = BufReader::new(self.stream.try_clone()?);
        let mut response_line = String::new();
        reader.read_line(&mut response_line)?;

        let colon_pos = response_line.find(':').ok_or("Invalid response format")?;
        let response: Value = serde_json::from_str(&response_line[colon_pos + 1..])?;

        if let Some(error) = response.get("error") {
            return Err(format!("Marionette error: {}", error).into());
        }

        Ok(response.get("value").unwrap_or(&Value::Null).clone())
    }

    pub fn set_context(&mut self, context: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.send_command("Marionette:SetContext", json!({ "value": context }))?;
        Ok(())
    }

    pub fn execute_script(
        &mut self,
        script: &str,
        args: Option<Vec<Value>>,
    ) -> Result<Value, Box<dyn std::error::Error>> {
        let params = json!({
            "script": script,
            "args": args.unwrap_or_default()
        });
        self.send_command("WebDriver:ExecuteScript", params)
    }
}

#[derive(Debug, Default)]
pub struct MarionetteSettings {
    pub host: String,
    pub port: u16,
}

impl MarionetteSettings {
    pub fn new() -> Self {
        Self {
            host: "localhost".to_string(),
            port: 2828,
        }
    }
}

pub struct MarionetteConnection {
    client: MarionetteClient,
}

impl MarionetteConnection {
    pub fn connect(settings: &MarionetteSettings) -> Result<Self, Box<dyn std::error::Error>> {
        let client = MarionetteClient::connect(&settings.host, settings.port)?;
        Ok(MarionetteConnection { client })
    }

    pub fn set_context(&mut self, context: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.client.set_context(context)
    }

    pub fn execute_script(
        &mut self,
        script: &str,
        args: Option<Vec<Value>>,
    ) -> Result<Value, Box<dyn std::error::Error>> {
        self.client.execute_script(script, args)
    }
}
