package com.masplatform.agent.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data @Builder
public class AgentDto {
    private UUID   id;
    private String name;
    private String instructions;
    private String provider;
    private String model;
    private List<Map<String, Object>> tools;
    private List<String> skills;
    private List<String> middleware;
    private boolean memoryEnabled;
    private String  runMode;
    private int     maxRunDurationMinutes;
    private String  personalizationPrompt;
    private Instant createdAt;
    private Instant updatedAt;
}
