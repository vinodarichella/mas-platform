package com.masplatform.agent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
public class AgentRequest {

    @NotBlank(message = "Agent name is required")
    private String name;

    private String instructions = "You are a helpful AI assistant.";

    @NotBlank(message = "Provider is required")
    private String provider;

    @NotBlank(message = "Model is required")
    private String model;

    private List<Map<String, Object>> tools = new ArrayList<>();
    private List<String> skills            = new ArrayList<>();
    private List<String> middleware        = new ArrayList<>();

    private boolean memoryEnabled          = true;

    @NotNull
    private String runMode                 = "interactive";

    @Positive
    private int maxRunDurationMinutes      = 30;

    private String personalizationPrompt;
}
