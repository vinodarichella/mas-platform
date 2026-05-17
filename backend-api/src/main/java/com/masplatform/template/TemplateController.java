package com.masplatform.template;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
public class TemplateController {

    private final TemplateService templateService;

    @GetMapping
    public List<TemplateDto> list(@RequestParam(required = false) String category) {
        return templateService.list(category);
    }

    @GetMapping("/{id}")
    public TemplateDto get(@PathVariable UUID id) {
        return templateService.get(id);
    }

    /** Copy a user's workflow into the shared templates library. */
    @PostMapping("/from-workflow/{workflowId}")
    @ResponseStatus(HttpStatus.CREATED)
    public TemplateDto saveAsTemplate(
            @PathVariable UUID workflowId,
            @AuthenticationPrincipal UserDetails user,
            @RequestBody Map<String, String> body) {
        return templateService.saveAsTemplate(
                workflowId,
                UUID.fromString(user.getUsername()),
                body.get("name"),
                body.get("description"),
                body.get("category"));
    }
}
