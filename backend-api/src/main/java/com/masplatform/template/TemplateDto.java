package com.masplatform.template;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class TemplateDto {
    private UUID                id;
    private String              name;
    private String              description;
    private String              category;
    private String              orchestrationType;
    private Map<String, Object> graphJson;
    private String              yamlContent;
    private boolean             isBuiltin;
    private Instant             createdAt;
}
